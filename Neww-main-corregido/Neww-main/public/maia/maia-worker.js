/*
 * Maia 3 — inferencia en JavaScript puro (sin dependencias), pensada para correr en un Web Worker.
 * Funciona 100 % offline. Lee el formato generado por scripts/convert-maia3.py (.json + .bin).
 * Sirve para cualquier tamaño de Maia 3 (3M, 5M, 23M, 79M): la configuración sale del manifiesto.
 *
 * Mensajes del worker:
 *   -> { type:'init', manifestUrl, binUrl }
 *   <- { type:'ready', config, loadMs } | { type:'error', message }
 *   -> { type:'run', id, frame: Float32Array(64*12), selfElo, oppoElo }
 *   <- { type:'result', id, move: Float32Array(4352), value: Float32Array(3), ms }   (buffers transferidos)
 *
 * `frame` es la tokenización del tablero (64 casillas x 12 canales) desde el punto de vista de quien mueve;
 * como la app no usa historial real de posiciones, el motor la repite `history` veces (igual que maia3/uci.py).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- funciones numéricas
  function erf(x) { // Abramowitz-Stegun 7.1.26 (error < 1.5e-7)
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  var SQRT1_2 = Math.SQRT1_2;
  function gelu(x) { return 0.5 * x * (1 + erf(x * SQRT1_2)); }

  function layerNorm(x, off, n, w, b, eps, out, outOff) {
    var mu = 0, i;
    for (i = 0; i < n; i++) mu += x[off + i];
    mu /= n;
    var v = 0;
    for (i = 0; i < n; i++) { var d = x[off + i] - mu; v += d * d; }
    var inv = 1 / Math.sqrt(v / n + eps);
    for (i = 0; i < n; i++) out[outOff + i] = (x[off + i] - mu) * inv * w[i] + b[i];
  }

  function rmsNormResidual(x, r, T, D, w, eps) { // x = rmsnorm(x + r) * w, en sitio
    for (var t = 0; t < T; t++) {
      var o = t * D, ss = 0, i;
      for (i = 0; i < D; i++) { var s = x[o + i] + r[o + i]; x[o + i] = s; ss += s * s; }
      var inv = 1 / Math.sqrt(ss / D + eps);
      for (i = 0; i < D; i++) x[o + i] = x[o + i] * inv * w[i];
    }
  }

  // ---------------------------------------------------------------- multiplicación de matrices
  // out[m*N+n] = sum_k x[m*K+k] * W[n*K+k] (+ b[n])      (W en formato PyTorch: [salida][entrada])
  function linF32(x, M, K, w, N, b, out) {
    var m, n, k, r;
    for (m = 0; m + 4 <= M; m += 4) {
      var x0 = m * K, x1 = x0 + K, x2 = x1 + K, x3 = x2 + K;
      for (n = 0; n < N; n++) {
        var wo = n * K, s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for (k = 0; k < K; k++) {
          var wk = w[wo + k];
          s0 += x[x0 + k] * wk; s1 += x[x1 + k] * wk; s2 += x[x2 + k] * wk; s3 += x[x3 + k] * wk;
        }
        var bn = b ? b[n] : 0;
        out[m * N + n] = s0 + bn; out[(m + 1) * N + n] = s1 + bn; out[(m + 2) * N + n] = s2 + bn; out[(m + 3) * N + n] = s3 + bn;
      }
    }
    for (r = M - (M % 4); r < M; r++) {
      var xr = r * K;
      for (n = 0; n < N; n++) {
        var wo2 = n * K, s = 0;
        for (k = 0; k < K; k++) s += x[xr + k] * w[wo2 + k];
        out[r * N + n] = s + (b ? b[n] : 0);
      }
    }
  }

  function linI8(x, M, K, w, sc, N, b, out) {
    var m, n, k, r;
    for (m = 0; m + 4 <= M; m += 4) {
      var x0 = m * K, x1 = x0 + K, x2 = x1 + K, x3 = x2 + K;
      for (n = 0; n < N; n++) {
        var wo = n * K, s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for (k = 0; k < K; k++) {
          var wk = w[wo + k];
          s0 += x[x0 + k] * wk; s1 += x[x1 + k] * wk; s2 += x[x2 + k] * wk; s3 += x[x3 + k] * wk;
        }
        var f = sc[n], bn = b ? b[n] : 0;
        out[m * N + n] = s0 * f + bn; out[(m + 1) * N + n] = s1 * f + bn; out[(m + 2) * N + n] = s2 * f + bn; out[(m + 3) * N + n] = s3 * f + bn;
      }
    }
    for (r = M - (M % 4); r < M; r++) {
      var xr = r * K;
      for (n = 0; n < N; n++) {
        var wo2 = n * K, s = 0;
        for (k = 0; k < K; k++) s += x[xr + k] * w[wo2 + k];
        out[r * N + n] = s * sc[n] + (b ? b[n] : 0);
      }
    }
  }

  // ---------------------------------------------------------------- carga del modelo
  function loadMaia3(manifest, buffer) {
    var cfg = manifest.config;
    var D = cfg.dim, H = cfg.heads, DH = D / H, T = 64, L = cfg.layers, HIST = cfg.history, DE = cfg.dimEmb;
    var HH = cfg.headHid, GEN = cfg.gabGen, PSQ = cfg.gabPerSquare, INTER = cfg.gabInter, MLP = cfg.mlp;
    var IN = 12 * HIST + 2 * DE;

    // acceso a tensores: {f32: Float32Array} o {q: Int8Array, s: Float32Array}
    function tensor(name) {
      var t = manifest.tensors[name];
      if (!t) throw new Error('Falta el tensor ' + name);
      var n = 1; for (var i = 0; i < t.shape.length; i++) n *= t.shape[i];
      if (t.dtype === 'f32') return { f32: new Float32Array(buffer, t.offset, n) };
      return { q: new Int8Array(buffer, t.offset, n), s: new Float32Array(buffer, t.scaleOffset, t.shape[0]) };
    }
    function vec(name) { var t = tensor(name); return t.f32; }
    function lin(x, M, K, wt, N, b, out) {
      if (wt.f32) linF32(x, M, K, wt.f32, N, b, out); else linI8(x, M, K, wt.q, wt.s, N, b, out);
    }

    var W = {
      eloLow: vec('elo_embedding_low.weight'), eloHigh: vec('elo_embedding_high.weight'),
      tokW: tensor('token_projection.weight'), tokB: vec('token_projection.bias'),
      normW: vec('transformer.norm.weight'), normB: vec('transformer.norm.bias'),
      lastW: vec('last_ln.weight'), lastB: vec('last_ln.bias'),
      valHidW: tensor('fc_value_hid.weight'), valHidB: vec('fc_value_hid.bias'),
      valW: tensor('fc_value.weight'), valB: vec('fc_value.bias'),
      sqFromW: tensor('proj_sq_from.weight'), sqToW: tensor('proj_sq_to.weight'),
      promoW: tensor('promo_bias_proj.weight'),
      layers: []
    };
    var sharedGab = manifest.tensors['gab_weight'] ? vec('gab_weight') : null;
    for (var i = 0; i < L; i++) {
      var p = 'transformer.layers.' + i + '.', a = p + 'self_attn.';
      W.layers.push({
        qkv: tensor(a + 'mha.in_proj_weight'), out: tensor(a + 'mha.out_proj.weight'),
        sm1W: PSQ > 0 ? tensor(a + 'sm1.weight') : null, sm1B: PSQ > 0 ? vec(a + 'sm1.bias') : null,
        sm2W: tensor(a + 'sm2.weight'), sm2B: vec(a + 'sm2.bias'),
        ln1W: vec(a + 'ln1.weight'), ln1B: vec(a + 'ln1.bias'),
        sm3W: tensor(a + 'sm3.weight'), sm3B: vec(a + 'sm3.bias'),
        ln2W: vec(a + 'ln2.weight'), ln2B: vec(a + 'ln2.bias'),
        gab: sharedGab || vec(a + 'gab_weight'),
        l1W: tensor(p + 'linear1.weight'), l1B: vec(p + 'linear1.bias'),
        l2W: tensor(p + 'linear2.weight'), l2B: vec(p + 'linear2.bias'),
        n1: vec(p + 'norm1.weight'), n2: vec(p + 'norm2.weight')
      });
    }

    // buffers de trabajo reutilizables
    var embs = new Float32Array(T * IN), x = new Float32Array(T * D), qkv = new Float32Array(T * 3 * D);
    var att = new Float32Array(T * D), sa = new Float32Array(T * D), ff = new Float32Array(T * MLP), ff2 = new Float32Array(T * D);
    var bias = new Float32Array(H * T * T), scores = new Float32Array(T);
    var sm1o = PSQ > 0 ? new Float32Array(T * PSQ) : null;
    var yv = new Float32Array(Math.max(INTER, D)), y3 = new Float32Array(H * GEN), y3n = new Float32Array(H * GEN);
    var sqFrom = new Float32Array(T * HH), sqTo = new Float32Array(T * HH);
    var base = new Float32Array(T * T), promoB = new Float32Array(8 * 4);
    var xm = new Float32Array(D), xmn = new Float32Array(D), vh = new Float32Array(HH), vh2 = new Float32Array(HH), val = new Float32Array(3);
    var attScale = 1 / Math.sqrt(DH), headScale = Math.sqrt(HH), invHeadScale = 1 / headScale;

    function eloEmb(elo, dst, off) {
      elo = Math.min(Math.max(elo, 0), cfg.eloMax);
      var lo = elo / cfg.eloMax, hi = 1 - lo;
      for (var i = 0; i < DE; i++) dst[off + i] = lo * W.eloLow[i] + hi * W.eloHigh[i];
    }

    function smolgen(Lw) { // rellena `bias` (H x 64 x 64) a partir de x
      var i, j;
      if (PSQ > 0) {
        lin(x, T, D, Lw.sm1W, PSQ, Lw.sm1B, sm1o);            // (64, PSQ)
        lin(sm1o, 1, T * PSQ, Lw.sm2W, INTER, Lw.sm2B, yv);    // (INTER)
      } else {
        for (j = 0; j < D; j++) xm[j] = 0;
        for (i = 0; i < T; i++) for (j = 0; j < D; j++) xm[j] += x[i * D + j];
        for (j = 0; j < D; j++) xm[j] /= T;
        lin(xm, 1, D, Lw.sm2W, INTER, Lw.sm2B, yv);
      }
      for (i = 0; i < INTER; i++) yv[i] = gelu(yv[i]);
      layerNorm(yv, 0, INTER, Lw.ln1W, Lw.ln1B, cfg.lnEps, yv, 0);
      lin(yv, 1, INTER, Lw.sm3W, H * GEN, Lw.sm3B, y3);
      for (i = 0; i < H * GEN; i++) y3[i] = gelu(y3[i]);
      layerNorm(y3, 0, H * GEN, Lw.ln2W, Lw.ln2B, cfg.lnEps, y3n, 0);
      linF32(y3n, H, GEN, Lw.gab, T * T, null, bias);          // (H, 4096): bias[h][o] = sum_i y[h][i]*gab[o][i]
    }

    function run(frame, selfElo, oppoElo) {
      var t0 = Date.now(), i, j, t, h, l;
      // embeddings de entrada: [historial de tokens | elo propio | elo rival]
      var se = new Float32Array(DE), oe = new Float32Array(DE);
      eloEmb(selfElo, se, 0); eloEmb(oppoElo, oe, 0);
      for (t = 0; t < T; t++) {
        var o = t * IN;
        for (var hh = 0; hh < HIST; hh++) for (j = 0; j < 12; j++) embs[o + hh * 12 + j] = frame[t * 12 + j];
        for (j = 0; j < DE; j++) { embs[o + 12 * HIST + j] = se[j]; embs[o + 12 * HIST + DE + j] = oe[j]; }
      }
      lin(embs, T, IN, W.tokW, D, W.tokB, x);

      for (l = 0; l < L; l++) {
        var Lw = W.layers[l];
        smolgen(Lw);
        lin(x, T, D, Lw.qkv, 3 * D, null, qkv);
        for (h = 0; h < H; h++) {
          for (i = 0; i < T; i++) {
            var qo = i * 3 * D + h * DH, mx = -Infinity;
            for (j = 0; j < T; j++) {
              var ko = j * 3 * D + D + h * DH, s = 0;
              for (var d = 0; d < DH; d++) s += qkv[qo + d] * qkv[ko + d];
              s = s * attScale + bias[h * T * T + i * T + j];
              scores[j] = s; if (s > mx) mx = s;
            }
            var sum = 0;
            for (j = 0; j < T; j++) { var e = Math.exp(scores[j] - mx); scores[j] = e; sum += e; }
            var inv = 1 / sum, ao = i * D + h * DH;
            for (d = 0; d < DH; d++) att[ao + d] = 0;
            for (j = 0; j < T; j++) {
              var pj = scores[j] * inv, vo = j * 3 * D + 2 * D + h * DH;
              for (d = 0; d < DH; d++) att[ao + d] += pj * qkv[vo + d];
            }
          }
        }
        lin(att, T, D, Lw.out, D, null, sa);
        rmsNormResidual(x, sa, T, D, Lw.n1, cfg.rmsEps);
        lin(x, T, D, Lw.l1W, MLP, Lw.l1B, ff);
        for (i = 0; i < T * MLP; i++) ff[i] = gelu(ff[i]);
        lin(ff, T, MLP, Lw.l2W, D, Lw.l2B, ff2);
        rmsNormResidual(x, ff2, T, D, Lw.n2, cfg.rmsEps);
      }
      for (t = 0; t < T; t++) layerNorm(x, t * D, D, W.normW, W.normB, cfg.lnEps, x, t * D);

      // política
      lin(x, T, D, W.sqFromW, HH, null, sqFrom);
      lin(x, T, D, W.sqToW, HH, null, sqTo);
      var move = new Float32Array(4352);
      for (i = 0; i < T; i++) for (j = 0; j < T; j++) {
        var s2 = 0, a1 = i * HH, b1 = j * HH;
        for (var k = 0; k < HH; k++) s2 += sqFrom[a1 + k] * sqTo[b1 + k];
        base[i * T + j] = s2 / headScale;
        move[i * T + j] = base[i * T + j];
      }
      // sesgo de promoción para las 8 casillas de la fila 8 (56..63)
      lin(sqTo.subarray(56 * HH), 8, HH, W.promoW, 4, null, promoB);
      var n = 4096;
      for (var ff_ = 0; ff_ < 8; ff_++) for (var ft = 0; ft < 8; ft++) for (var pc = 0; pc < 4; pc++)
        move[n++] = base[(48 + ff_) * T + 56 + ft] + promoB[ft * 4 + pc] * headScale;

      // valor (victoria/tablas/derrota desde quien mueve)
      for (j = 0; j < D; j++) xm[j] = 0;
      for (i = 0; i < T; i++) for (j = 0; j < D; j++) xm[j] += x[i * D + j];
      for (j = 0; j < D; j++) xm[j] /= T;
      layerNorm(xm, 0, D, W.lastW, W.lastB, cfg.lnEps, xmn, 0);
      lin(xmn, 1, D, W.valHidW, HH, W.valHidB, vh);
      for (j = 0; j < HH; j++) vh[j] = vh[j] > 0 ? vh[j] : 0;
      lin(vh, 1, HH, W.valW, 3, W.valB, val);
      return { move: move, value: Float32Array.from(val), ms: Date.now() - t0 };
    }

    return { config: cfg, run: run };
  }

  // ---------------------------------------------------------------- Web Worker
  var isWorker = typeof self !== 'undefined' && typeof self.postMessage === 'function' &&
    typeof importScripts === 'function' && typeof window === 'undefined';
  if (isWorker) {
    var model = null;
    self.onmessage = function (e) {
      var d = e.data;
      if (d.type === 'init') {
        var t0 = Date.now();
        fetch(d.manifestUrl).then(function (r) { if (!r.ok) throw new Error('manifiesto ' + r.status); return r.json(); })
          .then(function (manifest) {
            var fetchBuf = function (url) {
              return fetch(url).then(function (r) { if (!r.ok) throw new Error('pesos ' + r.status + ' ' + url); return r.arrayBuffer(); });
            };
            if (!manifest.parts) return fetchBuf(d.binUrl).then(function (buf) { return [manifest, buf]; });
            // Pesos partidos en trozos (<= 24 MB cada uno): se copian en orden a un único buffer
            var base = d.manifestUrl.replace(/[^\/]*$/, '');
            var whole = new ArrayBuffer(manifest.bytes), offset = 0, chain = Promise.resolve();
            manifest.parts.forEach(function (name) {
              chain = chain.then(function () { return fetchBuf(base + name); }).then(function (part) {
                new Uint8Array(whole, offset).set(new Uint8Array(part)); offset += part.byteLength;
              });
            });
            return chain.then(function () {
              if (offset !== manifest.bytes) throw new Error('pesos incompletos: ' + offset + ' de ' + manifest.bytes + ' bytes');
              return [manifest, whole];
            });
          })
          .then(function (res) {
            model = loadMaia3(res[0], res[1]);
            self.postMessage({ type: 'ready', config: model.config, loadMs: Date.now() - t0 });
          })
          .catch(function (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); });
      } else if (d.type === 'run') {
        if (!model) { self.postMessage({ type: 'error', id: d.id, message: 'modelo no cargado' }); return; }
        try {
          var out = model.run(d.frame, d.selfElo, d.oppoElo);
          self.postMessage({ type: 'result', id: d.id, move: out.move, value: out.value, ms: out.ms }, [out.move.buffer, out.value.buffer]);
        } catch (err) {
          self.postMessage({ type: 'error', id: d.id, message: String(err && err.message || err) });
        }
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { loadMaia3: loadMaia3 };
  else root.loadMaia3 = loadMaia3;
})(typeof self !== 'undefined' ? self : this);
