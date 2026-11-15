/* 图片尺寸探测：只解析文件头，不解码像素。
   覆盖 PNG(IHDR) / JPEG(SOF) / GIF / WebP(VP8/VP8L/VP8X)，
   用于给 og:image:width/height 提供真实数值，替代猜测的静态尺寸。 */

export interface ImageSize {
  width: number;
  height: number;
}

function viewUint32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function viewUint16BE(b: Uint8Array, o: number): number {
  return ((b[o] << 8) | b[o + 1]) >>> 0;
}

function viewUint16LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8)) >>> 0;
}

function valid(size: ImageSize | null): ImageSize | null {
  if (!size) return null;
  return size.width > 0 && size.height > 0 && size.width <= 30000 && size.height <= 30000 ? size : null;
}

/** 从文件头字节解析图片尺寸；无法识别返回 null */
export function parseImageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 12) return null;

  // PNG：签名 8 字节 + IHDR 块，宽高 big-endian 位于 16..24
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    if (bytes.length < 24) return null;
    return valid({ width: viewUint32BE(bytes, 16), height: viewUint32BE(bytes, 20) });
  }

  // GIF：GIF87a / GIF89a，宽高 little-endian 位于 6..10
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    if (bytes.length < 10) return null;
    return valid({ width: viewUint16LE(bytes, 6), height: viewUint16LE(bytes, 8) });
  }

  // JPEG：SOI 后按段扫描，SOF0..SOF15（除 C4/C8/CC）携带宽高
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = viewUint16BE(bytes, offset + 2);
      if (length < 2) return null;
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        // SOF: [长度2][精度1][高2][宽2]
        return valid({ height: viewUint16BE(bytes, offset + 5), width: viewUint16BE(bytes, offset + 7) });
      }
      offset += 2 + length;
    }
    return null;
  }

  // WebP：RIFF....WEBP，按 chunk 四字符分派
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    if (bytes.length < 30) return null;
    const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (fourcc === "VP8 ") {
      // lossy：帧头 3 字节 + 同步码 9d 01 2a，宽高 little-endian 在 26/28（低 14 位）
      return valid({ width: viewUint16LE(bytes, 26) & 0x3fff, height: viewUint16LE(bytes, 28) & 0x3fff });
    }
    if (fourcc === "VP8L" && bytes.length >= 25) {
      // lossless：签名 0x2f 后 14+14 位宽高（+1）
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      return valid({
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      });
    }
    if (fourcc === "VP8X") {
      // extended：画布 24 位宽高（-1 编码，即 +1 还原）位于 24..30
      if (bytes.length < 30) return null;
      return valid({
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      });
    }
    return null;
  }

  return null;
}
