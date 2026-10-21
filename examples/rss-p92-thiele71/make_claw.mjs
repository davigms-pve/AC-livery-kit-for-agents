// Writes a crude three-slash "claw" placeholder (NOT the trademark artwork) so the example can be rebuilt from a fresh checkout.
// usage: node make_claw.mjs <out.png>   (run from the repo root so `sharp` resolves)
import sharp from 'sharp';
const bar = (x, top, h, skew) => `<path d="M${x} ${top} L${x + 70} ${top} L${x + 70 + skew} ${top + h} L${x + skew} ${top + h} Z" fill="#8c8f94" stroke="#222" stroke-width="6" stroke-linejoin="round"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">${bar(60, 20, 430, 40)}${bar(160, 0, 470, 40)}${bar(260, 30, 420, 40)}</svg>`;
await sharp(Buffer.from(svg), { density: 200 }).png().toFile(process.argv[2]);
