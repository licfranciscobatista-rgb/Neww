# Componentes de terceros incluidos

Esta app distribuye los siguientes componentes. Conserva este archivo junto con la app.

| Componente | Ubicación | Licencia | Notas |
|---|---|---|---|
| **Stockfish 19** (WASM) | `public/stockfish/` | GPL-3.0 | Distribuir la app con este motor implica cumplir la GPL-3.0 (ofrecer el código fuente correspondiente). Código: https://github.com/official-stockfish/Stockfish |
| **GarboChess** (JavaScript, Gary Linscott) | `public/garbo/garbochess.js` | BSD de 3 cláusulas | Copyright (c) 2011 Gary Linscott. El texto completo está en `public/garbo/LICENSE-GarboChess.txt`; debe conservarse. Archivo sin modificar. |
| **Maia 3** (opcional; pesos no incluidos por defecto) | `public/maia/`, `scripts/convert-maia3.py` | AGPL-3.0 (código) | CSSLab, Universidad de Toronto: https://github.com/CSSLab/maia3 . El motor JS de `public/maia/maia-worker.js` es una reimplementación de la inferencia. Revisa la licencia de los pesos en Hugging Face antes de distribuirlos. |
| **chess.js** | dependencia npm | BSD-2-Clause | https://github.com/jhlywa/chess.js |

Este archivo es informativo y no constituye asesoría legal.
