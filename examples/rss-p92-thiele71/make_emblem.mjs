// Writes a placeholder round club emblem (cyan disc, dark ring, "SC 1919"). It is NOT the club's artwork: a stand-in until the real file is supplied.
// usage: node make_emblem.mjs <out.png>
import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><circle cx="150" cy="150" r="138" fill="#4ec4d6" stroke="#0b3b44" stroke-width="14"/>` +
  `<text x="150" y="175" font-family="DejaVu Sans, Verdana, sans-serif" font-size="110" font-weight="700" text-anchor="middle" fill="#0b3b44">SC</text>` +
  `<text x="150" y="232" font-family="DejaVu Sans, Verdana, sans-serif" font-size="50" font-weight="700" text-anchor="middle" fill="#0b3b44">1919</text></svg>`;
await sharp(Buffer.from(svg), { density: 144 }).png().toFile(process.argv[2]);
