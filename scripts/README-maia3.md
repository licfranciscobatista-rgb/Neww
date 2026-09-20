# Maia 3 real en la app (offline)

La app usa Maia 3 (red neuronal) **si encuentra los pesos**; si no, sigue con la simulación heurística.

## Instalar el modelo
1. Baja un checkpoint oficial (`maia3-5m.pt`, `maia3-23m.pt`, `maia3-79m.pt`...) desde Hugging Face (`UofTCSSLab/Maia3-...`).
2. Conviértelo (solo Python + numpy; no necesita PyTorch):

       python scripts/convert-maia3.py maia3-5m.pt public/maia/maia3 --dtype int8

   Genera `public/maia/maia3.json` y los pesos (`maia3.bin`). El motor deduce el tamaño solo.
3. Recompila la app (`npm run build` / APK).

## Límite de 25 MB por archivo
Si los pesos superan 22 MB el conversor los parte solo en `maia3.bin.0`, `maia3.bin.1`, ... y el motor los une al cargar.
Ojo: GitHub cuenta en MB **decimales** (25 MB = 25 000 000 bytes), por eso el tamaño por defecto es 22. Se cambia con
`--max-part-mb`. Sube **todos** los trozos junto a `maia3.json`.

## Qué tamaño elegir (PC de escritorio, 1 hilo; en móvil cuenta 3-5 veces más)
| Modelo | Peso (int8) | Archivos | Tiempo por posición |
|---|---|---|---|
| 3M  | ~4 MB  | 1 | ~0,2 s |
| 5M  | ~6 MB  | 1 | ~0,35 s |
| 23M | ~24 MB | 1 (justo) | ~1,3 s |
| 79M | ~78 MB | 4 | ~4,7 s |

Para un teléfono se recomienda **5M** (o 23M). El de 79M funciona, pero es lento.

## Verificación
`scripts/maia3_reference.py` es una implementación de referencia en numpy (traducida de `maia3/models.py`);
el motor JavaScript coincide con ella a ~2e-5 en los logits.

## Licencias
El código de Maia 3 es AGPL-3.0. Revisa también la licencia de los pesos en su página de Hugging Face.
