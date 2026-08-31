/**
 * 极简 PNG 解码器 —— 只为对比度审计读回像素用。
 *
 * 刻意不引 sharp / pngjs：这个脚本要在 CI 里跑，多一个原生依赖就多一份
 * 装不上的风险，而我们只需要「8 位、非隔行」这一种情况（Playwright 截图就是）。
 *
 * 支持 colorType 2（RGB）与 6（RGBA），bitDepth 8，interlace 0。
 */

import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @param {Buffer} buf PNG 文件内容
 * @returns {{ width: number, height: number, data: Uint8Array }} data 为 RGBA，每像素 4 字节
 */
export function decodePng(buf) {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) throw new Error('不是合法的 PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      const interlace = body[12];
      if (bitDepth !== 8) throw new Error(`只支持 8 位深度，实际 ${bitDepth}`);
      if (colorType !== 2 && colorType !== 6) {
        throw new Error(`只支持 colorType 2/6，实际 ${colorType}`);
      }
      if (interlace !== 0) throw new Error('不支持隔行 PNG');
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length; // length(4) + type(4) + data + crc(4)
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);

  // 逐扫描线反滤波（PNG 的 5 种 filter）
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + 1 + x];
      const a = x >= channels ? cur[x - channels] : 0; // 左
      const b = prev[x]; // 上
      const c = x >= channels ? prev[x - channels] : 0; // 左上
      let value;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`未知的 PNG filter：${filter}`);
      }
      cur[x] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      out[dst] = cur[src];
      out[dst + 1] = cur[src + 1];
      out[dst + 2] = cur[src + 2];
      out[dst + 3] = channels === 4 ? cur[src + 3] : 255;
    }
    prev.set(cur);
  }

  return { width, height, data: out };
}
