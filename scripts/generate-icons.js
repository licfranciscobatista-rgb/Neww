import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

function drawIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const center = size / 2;
  const radius = size * 0.46;
  const cornerRadius = isMaskable ? 0 : size * 0.22; // Full bleed background for maskable

  // Colors
  const darkNavy = [15, 23, 42];
  const royalBlue = [2, 132, 199];
  const skyBlue = [56, 189, 248];
  const white = [255, 255, 255];
  const gold = [251, 191, 36];
  const emerald = [52, 211, 153];
  const purple = [192, 132, 252];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Rounded rectangle test for non-maskable icons
      if (!isMaskable) {
        const dx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
        const dy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          // Outside rounded rect
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
      }

      // Background Gradient (Dark slate to vibrant blue)
      const gradFactor = (x + y) / (size * 2);
      let r = Math.round(darkNavy[0] * (1 - gradFactor) + royalBlue[0] * gradFactor);
      let g = Math.round(darkNavy[1] * (1 - gradFactor) + royalBlue[1] * gradFactor);
      let b = Math.round(darkNavy[2] * (1 - gradFactor) + royalBlue[2] * gradFactor);
      let a = 255;

      // Border glow
      const distFromCenter = Math.hypot(x - center, y - center);
      if (!isMaskable && distFromCenter > radius - 3 && distFromCenter < radius) {
        r = skyBlue[0];
        g = skyBlue[1];
        b = skyBlue[2];
      }

      // Normalized coordinates from center (-1 to 1)
      const nx = (x - center) / (size * 0.5);
      const ny = (y - center) / (size * 0.5);

      // Safe zone factor for maskable
      const scale = isMaskable ? 0.65 : 0.78;
      const sx = nx / scale;
      const sy = ny / scale;

      // Draw stylized Knight Chess Piece:
      // Base: rounded pedestal
      const inBase = sy > 0.45 && sy < 0.65 && Math.abs(sx) < (0.55 - (sy - 0.45) * 0.2);
      const inBasePlinth = sy >= 0.65 && sy < 0.75 && Math.abs(sx) < 0.62;

      // Knight chest/snout/ears
      const inBody = sy > -0.15 && sy <= 0.45 && sx > -0.45 && sx < 0.45;
      const inNeck = sy > -0.55 && sy <= -0.15 && sx > -0.25 && sx < 0.42;
      const inSnout = sy > -0.45 && sy < 0.1 && sx >= -0.55 && sx <= -0.15;
      const inEar = sy > -0.75 && sy <= -0.55 && sx > -0.05 && sx < 0.25;

      if (inBasePlinth || inBase || inBody || inNeck || inSnout || inEar) {
        // Inner shadow / gradient on knight
        const pieceGrad = (sy + 0.75) / 1.5;
        r = Math.round(white[0] * (1 - pieceGrad * 0.15));
        g = Math.round(white[1] * (1 - pieceGrad * 0.15));
        b = Math.round(white[2] * (1 - pieceGrad * 0.1));

        // Knight eye
        const eyeDist = Math.hypot(sx - (-0.22), sy - (-0.32));
        if (eyeDist < 0.05) {
          r = royalBlue[0];
          g = royalBlue[1];
          b = royalBlue[2];
        } else if (eyeDist < 0.07 && eyeDist >= 0.05) {
          r = 200;
          g = 220;
          b = 240;
        }

        // Muzzle notch
        if (sy > -0.05 && sy < 0.02 && sx < -0.38) {
          r = darkNavy[0];
          g = darkNavy[1];
          b = darkNavy[2];
        }
      }

      // 4 Engine dots at the base
      const dotY = isMaskable ? 0.82 : 0.84;
      if (Math.abs(ny - dotY) < 0.045) {
        if (Math.hypot(nx - (-0.36), ny - dotY) < 0.035) {
          // Stockfish (Sky Blue)
          r = skyBlue[0]; g = skyBlue[1]; b = skyBlue[2];
        } else if (Math.hypot(nx - (-0.12), ny - dotY) < 0.035) {
          // GarboChess (Emerald)
          r = emerald[0]; g = emerald[1]; b = emerald[2];
        } else if (Math.hypot(nx - 0.12, ny - dotY) < 0.035) {
          // Maia (Purple)
          r = purple[0]; g = purple[1]; b = purple[2];
        } else if (Math.hypot(nx - 0.36, ny - dotY) < 0.035) {
          // Personal (Gold)
          r = gold[0]; g = gold[1]; b = gold[2];
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. 192x192
const p192 = drawIcon(192, false);
p192.pack().pipe(fs.createWriteStream(path.join(publicDir, 'pwa-192x192.png')));

// 2. 512x512
const p512 = drawIcon(512, false);
p512.pack().pipe(fs.createWriteStream(path.join(publicDir, 'pwa-512x512.png')));

// 3. Maskable 512x512
const pMask = drawIcon(512, true);
pMask.pack().pipe(fs.createWriteStream(path.join(publicDir, 'pwa-maskable-512x512.png')));

// 4. Apple Touch Icon 180x180
const pApple = drawIcon(180, false);
pApple.pack().pipe(fs.createWriteStream(path.join(publicDir, 'apple-touch-icon.png')));

// 5. Favicon 64x64
const pFavicon = drawIcon(64, false);
pFavicon.pack().pipe(fs.createWriteStream(path.join(publicDir, 'favicon.ico')));

// 6. SVG Icon for browser tabs
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)" stroke="#38bdf8" stroke-width="8"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="#38bdf8" stroke-width="4" opacity="0.4"/>
  <!-- Stylized Knight -->
  <path d="M 160 400 L 352 400 L 352 380 L 330 360 L 320 220 L 290 140 L 250 140 L 250 170 L 200 190 L 170 260 L 200 270 L 190 320 L 180 360 L 160 380 Z" fill="#ffffff"/>
  <circle cx="225" cy="220" r="10" fill="#0284c7" />
  <!-- Engine dots -->
  <circle cx="160" cy="445" r="14" fill="#38bdf8" />
  <circle cx="224" cy="445" r="14" fill="#34d399" />
  <circle cx="288" cy="445" r="14" fill="#c084fc" />
  <circle cx="352" cy="445" r="14" fill="#fbbf24" />
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('PWA icons successfully generated in /public!');
