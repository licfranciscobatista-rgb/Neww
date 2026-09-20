#!/usr/bin/env python3
"""
Convierte un checkpoint de Maia 3 (.pt) a un formato binario simple para el navegador/APK.

    python scripts/convert-maia3.py maia3-5m.pt  public/maia/maia3  --dtype int8

Genera:  <salida>.json  (configuración + índice de tensores)   y   <salida>.bin  (pesos)

- NO necesita PyTorch: solo Python 3.9+ y numpy. Lee el .pt (un zip con un pickle) con un lector propio.
- La configuración (dimensión, cabezas, capas…) se deduce de las formas de los tensores, así que sirve
  para cualquier tamaño de Maia 3 (3M, 5M, 23M, 79M).
- --dtype fp32  : pesos sin pérdida (el archivo pesa ~4 bytes por parámetro).
- --dtype int8  : matrices cuantizadas por fila (~1 byte por parámetro); el resto queda en fp32.
- Si el .bin supera --max-part-mb (22 por defecto, en MB decimales) se reparte en trozos <bin>.0, <bin>.1, ... que el motor une al cargar.
"""
import argparse, collections, json, pickle, re, sys, zipfile
import numpy as np

# ----------------------------------------------------------------------------------------------
# Lector mínimo de .pt (formato zip de PyTorch) sin torch
# ----------------------------------------------------------------------------------------------
_DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64,
       'LongStorage': np.int64, 'IntStorage': np.int32, 'BoolStorage': np.bool_, 'ByteStorage': np.uint8}


def _rebuild_tensor_v2(storage, offset, size, stride, *_a, **_k):
    if len(size) == 0:
        return np.array(storage[offset])
    span = sum((s - 1) * st for s, st in zip(size, stride)) + 1
    flat = storage[offset:offset + span]
    view = np.lib.stride_tricks.as_strided(flat, shape=tuple(size), strides=tuple(st * flat.itemsize for st in stride))
    return np.array(view)


class _Unpickler(pickle.Unpickler):
    def __init__(self, f, zf, prefix):
        super().__init__(f)
        self.zf, self.prefix = zf, prefix

    def find_class(self, module, name):
        if name == '_rebuild_tensor_v2':
            return _rebuild_tensor_v2
        if name in _DT:
            return ('storage_type', name)
        if module == 'collections' and name == 'OrderedDict':
            return collections.OrderedDict
        if module.startswith('torch'):
            return lambda *a, **k: ('torch_obj', module, name)
        return super().find_class(module, name)

    def persistent_load(self, pid):
        _typ, storage_type, key, _loc, numel = pid
        raw = self.zf.read(f'{self.prefix}/data/{key}')
        return np.frombuffer(raw, dtype=_DT[storage_type[1]], count=numel)


def load_pt(path):
    zf = zipfile.ZipFile(path)
    prefix = zf.namelist()[0].split('/')[0]
    with zf.open(f'{prefix}/data.pkl') as f:
        obj = _Unpickler(f, zf, prefix).load()
    if isinstance(obj, dict) and 'model_state_dict' in obj:
        obj = obj['model_state_dict']
    return obj


# ----------------------------------------------------------------------------------------------
# Deducción de la configuración a partir de las formas
# ----------------------------------------------------------------------------------------------
def infer_config(sd):
    layers = sorted({int(m.group(1)) for k in sd for m in [re.match(r'transformer\.layers\.(\d+)\.', k)] if m})
    dim_emb = sd['elo_embedding_low.weight'].shape[1]
    dim = sd['token_projection.weight'].shape[0]
    in_dim = sd['token_projection.weight'].shape[1]
    history = (in_dim - 2 * dim_emb) // 12
    if history * 12 + 2 * dim_emb != in_dim:
        raise SystemExit('Este checkpoint incluye información de tiempo u otra variante que no está soportada.')
    a = 'transformer.layers.0.self_attn.'
    gab_w = sd.get('smolgen_shared_weight', sd.get(a + 'smolgen_weight'))
    gab_gen = gab_w.shape[1]
    heads = sd[a + 'sm3.weight'].shape[0] // gab_gen
    cfg = dict(
        dim=int(dim), layers=len(layers), heads=int(heads), mlp=int(sd['transformer.layers.0.linear1.weight'].shape[0]),
        headHid=int(sd['proj_sq_from.weight'].shape[0]), gabGen=int(gab_gen),
        gabPerSquare=int(sd[a + 'sm1.weight'].shape[0]) if (a + 'sm1.weight') in sd else 0,
        gabInter=int(sd[a + 'sm2.weight'].shape[0]), history=int(history), dimEmb=int(dim_emb),
        rmsEps=float(np.finfo(np.float32).eps), lnEps=1e-5, eloMax=5000,
    )
    # Variantes no soportadas: se comprueba que coincidan con la arquitectura que implementa el motor web.
    problems = []
    if any('abs_pe' in k for k in sd): problems.append('abs_pe')
    if any('in_proj_bias' in k or 'out_proj.bias' in k for k in sd): problems.append('sesgos qkv')
    if any('relative_bias' in k for k in sd): problems.append('relative_bias')
    if problems:
        raise SystemExit('Variante de Maia 3 no soportada por el motor web: ' + ', '.join(problems))
    return cfg, layers


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('checkpoint')
    ap.add_argument('output', help='prefijo de salida, p. ej. public/maia/maia3')
    ap.add_argument('--dtype', choices=['fp32', 'int8'], default='int8')
    ap.add_argument('--name', default=None)
    ap.add_argument('--max-part-mb', type=float, default=22.0,
                    help='si los pesos superan este tamaño se parten en trozos (.bin.0, .bin.1, ...). '
                         'Se cuenta en MB DECIMALES (1 MB = 1 000 000 bytes), como GitHub: el límite de 25 MB de la subida '
                         'web son 25 000 000 bytes. 0 = no partir')
    args = ap.parse_args()

    sd = load_pt(args.checkpoint)
    cfg, layers = infer_config(sd)
    print('configuración deducida:', cfg)

    # Los pesos de "smolgen"/"gab" están atados entre capas: si son idénticos se guardan una sola vez.
    shared = sd.get('smolgen_shared_weight')
    per_layer = [sd[f'transformer.layers.{i}.self_attn.smolgen_weight'] for i in layers]
    tied = shared is not None and all(np.array_equal(shared, w) for w in per_layer)
    print('smolgen atado entre capas:', tied)

    tensors = collections.OrderedDict()
    for name, arr in sd.items():
        if name.endswith('smolgen_weight') or name == 'smolgen_shared_weight':
            continue
        tensors[name] = np.asarray(arr, dtype=np.float32)
    if tied:
        tensors['gab_weight'] = np.asarray(shared, dtype=np.float32)
    else:
        for i, w in zip(layers, per_layer):
            tensors[f'transformer.layers.{i}.self_attn.gab_weight'] = np.asarray(w, dtype=np.float32)

    def quantizable(name, a):
        return args.dtype == 'int8' and a.ndim == 2 and a.size >= 16_384 and 'gab_weight' not in name

    manifest = {'format': 'maia3-web-v1', 'name': args.name or re.sub(r'\.pt$', '', args.checkpoint.split('/')[-1]),
                'config': cfg, 'dtype': args.dtype, 'tied_gab': bool(tied), 'tensors': {}}
    chunks, pos = [], 0

    def push(buf: bytes, align):
        nonlocal pos
        pad = (-pos) % align
        if pad:
            chunks.append(b'\0' * pad); pos += pad
        off = pos
        chunks.append(buf); pos += len(buf)
        return off

    total_q_err = []
    for name, a in tensors.items():
        entry = {'shape': list(a.shape)}
        if quantizable(name, a):
            scale = np.abs(a).max(axis=1) / 127.0
            scale[scale == 0] = 1.0
            q = np.clip(np.rint(a / scale[:, None]), -127, 127).astype(np.int8)
            entry.update(dtype='i8', offset=push(q.tobytes(), 4), scaleOffset=push(scale.astype(np.float32).tobytes(), 4))
            total_q_err.append(float(np.abs(q * scale[:, None] - a).mean() / (np.abs(a).mean() + 1e-12)))
        else:
            entry.update(dtype='f32', offset=push(np.ascontiguousarray(a).tobytes(), 4))
        manifest['tensors'][name] = entry

    out_bin, out_json = args.output + '.bin', args.output + '.json'
    data = b''.join(chunks)
    manifest['bytes'] = len(data)
    part_size = int(args.max_part_mb * 1_000_000)
    written = []
    if part_size and len(data) > part_size:
        names = []
        for i in range(0, len(data), part_size):
            name = f'{out_bin}.{len(names)}'
            with open(name, 'wb') as f:
                f.write(data[i:i + part_size])
            names.append(name.split('/')[-1])
            written.append(name)
        manifest['parts'] = names          # nombres de archivo, en orden, junto al .json
    else:
        with open(out_bin, 'wb') as f:
            f.write(data)
        written.append(out_bin)
    with open(out_json, 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))
    params = sum(a.size for a in tensors.values())
    print(f'{params/1e6:.1f} M parámetros -> {len(data)/1048576:.1f} MB ({args.dtype}) en {len(written)} archivo(s): ' + ', '.join(w.split('/')[-1] for w in written) + f' + {out_json.split("/")[-1]}')
    if total_q_err:
        print(f'error relativo medio de cuantización int8: {100*np.mean(total_q_err):.2f} %')


if __name__ == '__main__':
    main()
