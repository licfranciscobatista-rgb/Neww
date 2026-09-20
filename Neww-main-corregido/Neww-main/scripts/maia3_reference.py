"""
Implementación de referencia de Maia 3 en numpy (traducción directa de maia3/models.py).
Sirve para comprobar el motor JavaScript: mismas entradas => mismos logits.

Uso como módulo:
    from maia3_reference import load_from_pt, load_from_bin, forward
"""
import json
import math
import numpy as np

try:
    from scipy.special import erf as _erf
except Exception:  # scipy no es obligatorio
    _erf = np.vectorize(math.erf)


def gelu(x):  # GELU exacto (el de torch por defecto)
    return 0.5 * x * (1.0 + _erf(x / math.sqrt(2.0)))


def layer_norm(x, w, b, eps=1e-5):
    mu = x.mean(axis=-1, keepdims=True)
    var = ((x - mu) ** 2).mean(axis=-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * w + b


def rms_norm(x, w, eps):
    return x / np.sqrt((x * x).mean(axis=-1, keepdims=True) + eps) * w


def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)


# ---------------------------------------------------------------------------------------------
def load_from_pt(path):
    """Pesos exactos (fp32) leídos directamente del .pt original."""
    import importlib.util, os
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location('convert_maia3', os.path.join(here, 'convert-maia3.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sd = mod.load_pt(path)
    cfg, layers = mod.infer_config(sd)
    W = {k: np.asarray(v, dtype=np.float32) for k, v in sd.items()}
    W['gab_weight'] = W['smolgen_shared_weight']
    return cfg, W


def load_from_bin(json_path, bin_path):
    """Pesos leídos del .bin generado por convert-maia3.py (int8 se descuantiza)."""
    import os
    m = json.load(open(json_path))
    if m.get('parts'):
        base = os.path.dirname(os.path.abspath(json_path))
        buf = b''.join(open(os.path.join(base, p), 'rb').read() for p in m['parts'])
    else:
        buf = open(bin_path, 'rb').read()
    W = {}
    for name, t in m['tensors'].items():
        shape = tuple(t['shape'])
        n = int(np.prod(shape)) if shape else 1
        if t['dtype'] == 'f32':
            W[name] = np.frombuffer(buf, dtype=np.float32, count=n, offset=t['offset']).reshape(shape).copy()
        else:
            q = np.frombuffer(buf, dtype=np.int8, count=n, offset=t['offset']).reshape(shape).astype(np.float32)
            s = np.frombuffer(buf, dtype=np.float32, count=shape[0], offset=t['scaleOffset'])
            W[name] = q * s[:, None]
    return m['config'], W


# ---------------------------------------------------------------------------------------------
def forward(cfg, W, frame, self_elo, oppo_elo):
    """
    frame: (64, 12) — tokenización del tablero desde el punto de vista de quien mueve.
    Devuelve (logits_move[4352], logits_value[3], ponder).
    """
    dim, H, hist = cfg['dim'], cfg['heads'], cfg['history']
    dh = dim // H
    T = 64

    def interp(e):
        e = float(min(max(e, 0), cfg['eloMax']))
        lo = e / cfg['eloMax']
        return lo * W['elo_embedding_low.weight'][0] + (1.0 - lo) * W['elo_embedding_high.weight'][0]

    tokens = np.tile(frame.astype(np.float32), (1, hist))                      # (64, 12*hist)
    embs = np.concatenate([tokens,
                           np.tile(interp(self_elo), (T, 1)),
                           np.tile(interp(oppo_elo), (T, 1))], axis=1)          # (64, 12*hist + 2*dimEmb)
    x = embs @ W['token_projection.weight'].T + W['token_projection.bias']       # (64, dim)

    for i in range(cfg['layers']):
        p = f'transformer.layers.{i}.'
        a = p + 'self_attn.'
        gab = W.get(a + 'gab_weight', W['gab_weight'])

        # --- sesgo de atención "smolgen" ---
        if cfg['gabPerSquare'] > 0:
            y = x @ W[a + 'sm1.weight'].T + W[a + 'sm1.bias']                   # (64, per_sq)
            y = y.reshape(-1)                                                    # (64*per_sq)
        else:
            y = x.mean(axis=0)
        y = gelu(y @ W[a + 'sm2.weight'].T + W[a + 'sm2.bias'])                 # (inter)
        y = layer_norm(y, W[a + 'ln1.weight'], W[a + 'ln1.bias'])
        y = gelu(y @ W[a + 'sm3.weight'].T + W[a + 'sm3.bias'])                 # (H*gen)
        y = layer_norm(y, W[a + 'ln2.weight'], W[a + 'ln2.bias']).reshape(H, cfg['gabGen'])
        bias = (y @ gab.T).reshape(H, T, T)                                      # (H, 64, 64)

        # --- atención ---
        wqkv = W[a + 'mha.in_proj_weight']
        q = (x @ wqkv[:dim].T).reshape(T, H, dh).transpose(1, 0, 2)
        k = (x @ wqkv[dim:2 * dim].T).reshape(T, H, dh).transpose(1, 0, 2)
        v = (x @ wqkv[2 * dim:].T).reshape(T, H, dh).transpose(1, 0, 2)
        scores = q @ k.transpose(0, 2, 1) / math.sqrt(dh) + bias                # (H, 64, 64)
        att = softmax(scores) @ v                                                # (H, 64, dh)
        att = att.transpose(1, 0, 2).reshape(T, dim)
        sa = att @ W[a + 'mha.out_proj.weight'].T
        x = rms_norm(x + sa, W[p + 'norm1.weight'], cfg['rmsEps'])

        # --- feed-forward ---
        ff = gelu(x @ W[p + 'linear1.weight'].T + W[p + 'linear1.bias']) @ W[p + 'linear2.weight'].T + W[p + 'linear2.bias']
        x = rms_norm(x + ff, W[p + 'norm2.weight'], cfg['rmsEps'])

    x = layer_norm(x, W['transformer.norm.weight'], W['transformer.norm.bias'])

    # --- política ---
    sq_from = x @ W['proj_sq_from.weight'].T                                     # (64, headHid)
    sq_to = x @ W['proj_sq_to.weight'].T
    hh = cfg['headHid']
    base = sq_from @ sq_to.T / math.sqrt(hh)                                     # (64, 64)
    promo_bias = (sq_to[56:64] @ W['promo_bias_proj.weight'].T) * math.sqrt(hh)  # (8, 4)
    promo = np.zeros(256, dtype=np.float32)
    n = 0
    for ff in range(8):
        for ft in range(8):
            for pc in range(4):
                promo[n] = base[48 + ff, 56 + ft] + promo_bias[ft, pc]
                n += 1
    logits_move = np.concatenate([base.reshape(-1), promo])

    # --- valor y "ponder" ---
    xm = layer_norm(x.mean(axis=0), W['last_ln.weight'], W['last_ln.bias'])
    v = np.maximum(xm @ W['fc_value_hid.weight'].T + W['fc_value_hid.bias'], 0)
    logits_value = v @ W['fc_value.weight'].T + W['fc_value.bias']
    p_ = np.maximum(xm @ W['fc_ponder_hid.weight'].T + W['fc_ponder_hid.bias'], 0)
    ponder = (p_ @ W['fc_ponder.weight'].T + W['fc_ponder.bias'])[0]
    return logits_move.astype(np.float32), logits_value.astype(np.float32), float(ponder)
