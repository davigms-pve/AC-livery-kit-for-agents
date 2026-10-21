import fs from 'node:fs';

const FLAGS = { CAPS: 0x1, HEIGHT: 0x2, WIDTH: 0x4, PITCH: 0x8, PIXELFORMAT: 0x1000, MIPMAPCOUNT: 0x20000, LINEARSIZE: 0x80000 };
const PF = { ALPHAPIXELS: 0x1, FOURCC: 0x4, RGB: 0x40 };
const BLOCK = { DXT1: 8, DXT3: 16, DXT5: 16, ATI1: 8, ATI2: 16 };

const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
export const mipLevels = (w, h) => Math.floor(Math.log2(Math.max(w, h))) + 1;

/** Read only the header (128 bytes) of a DDS file. Never loads the pixel data. */
export function readHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(128);
    const n = fs.readSync(fd, head, 0, 128, 0);
    return { head: head.subarray(0, n), size: fs.fstatSync(fd).size };
  } finally { fs.closeSync(fd); }
}

/**
 * Check a DDS file the way a loader would, and say what is wrong in words.
 * Returns { info, issues: [{level, message}] }. `error` means the game will likely refuse it.
 */
export function validateDds(file) {
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  const { head, size } = readHeader(file);
  if (head.length < 128 || head.toString('latin1', 0, 4) !== 'DDS ') {
    add('error', 'not a DDS file (missing "DDS " magic)');
    return { info: { bytes: size }, issues };
  }
  const flags = head.readUInt32LE(8), height = head.readUInt32LE(12), width = head.readUInt32LE(16);
  const mips = head.readUInt32LE(28) || 1;
  const pfFlags = head.readUInt32LE(80), fourCC = head.toString('latin1', 84, 88).replace(/\0/g, '');
  const rgbBits = head.readUInt32LE(88);
  const info = { width, height, mips, fourCC: fourCC || null, pixelFormatFlags: pfFlags, rgbBitCount: rgbBits, bytes: size };

  if (head.readUInt32LE(4) !== 124) add('error', `header size is ${head.readUInt32LE(4)}, expected 124`);
  if (!(flags & FLAGS.PIXELFORMAT)) add('error', 'DDSD_PIXELFORMAT flag not set');
  if (!width || !height) add('error', 'zero width or height');
  if (head.readUInt32LE(76) !== 32) add('error', `pixel format block size is ${head.readUInt32LE(76)}, expected 32`);

  if (pfFlags & PF.FOURCC) {
    if (!BLOCK[fourCC]) add('error', `unsupported compressed format "${fourCC}" (supported here: ${Object.keys(BLOCK).join(', ')})`);
    if (pfFlags & PF.RGB) add('error', 'both FOURCC and RGB pixel-format flags are set: contradictory header');
  } else if (pfFlags & PF.RGB) {
    // The "invalid bpp value for RGB data: 0" failure: flagged as uncompressed RGB but no bit count.
    if (!rgbBits) add('error', 'header says uncompressed RGB but the bit count is 0 ("invalid bpp" in-game)');
  } else {
    add('error', 'pixel format has neither FOURCC nor RGB flag');
  }

  const levels = mipLevels(width, height);
  if (mips < levels) add('warn', `mip chain is ${mips} levels, a full chain would be ${levels} (distant textures shimmer)`);
  if (!(flags & FLAGS.MIPMAPCOUNT) && mips > 1) add('warn', 'mip count set but DDSD_MIPMAPCOUNT flag is not');
  if (!isPow2(width) || !isPow2(height)) {
    add('note', `${width}x${height} is not a power of two. The P92's own 8192x2956 green skin shows in the game's preview, so that size loads on that car; other cars and sizes are unverified (UVs are normalised, so a power-of-two size draws the same art)`);
  }

  if (BLOCK[fourCC] && (width % 4 || height % 4)) {
    add('warn', `${width}x${height}: block-compressed (${fourCC}) textures are safest with width and height multiples of 4`);
  }

  // Expected file size from format + mip chain.
  if (BLOCK[fourCC]) {
    let expected = 128;
    for (let l = 0, w = width, h = height; l < mips; l++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
      expected += Math.ceil(w / 4) * Math.ceil(h / 4) * BLOCK[fourCC];
    }
    info.expectedBytes = expected;
    if (size < expected) add('error', `file is ${size} bytes but the header implies ${expected}: truncated`);
    else if (size > expected) add('warn', `file is ${size - expected} bytes larger than the header implies`);
  }
  return { info, issues };
}

export const worst = (issues) => (issues.some((i) => i.level === 'error') ? 'error' : issues.some((i) => i.level === 'warn') ? 'warn' : 'ok');
