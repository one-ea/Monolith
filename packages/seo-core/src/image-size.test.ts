import { describe, expect, it } from "vitest";
import { parseImageSize } from "./image-size";

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const w = width >>> 0, h = height >>> 0;
  bytes[16] = (w >>> 24) & 0xff; bytes[17] = (w >>> 16) & 0xff; bytes[18] = (w >>> 8) & 0xff; bytes[19] = w & 0xff;
  bytes[20] = (h >>> 24) & 0xff; bytes[21] = (h >>> 16) & 0xff; bytes[22] = (h >>> 8) & 0xff; bytes[23] = h & 0xff;
  return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
  // SOI + 2 字节噪声(测试逐字节扫描) + APP0 段 + SOF0：[FF C0][长度][精度][高][宽]
  const bytes = new Uint8Array(31);
  bytes[0] = 0xff; bytes[1] = 0xd8;
  bytes[4] = 0xff; bytes[5] = 0xe0; // APP0 marker
  bytes[6] = 0x00; bytes[7] = 0x10; // length 16
  let offset = 4 + 2 + 16;
  bytes[offset] = 0xff; bytes[offset + 1] = 0xc0; // SOF0
  bytes[offset + 2] = 0x00; bytes[offset + 3] = 0x11; // length 17
  bytes[offset + 4] = 0x08; // precision
  bytes[offset + 5] = (height >> 8) & 0xff; bytes[offset + 6] = height & 0xff;
  bytes[offset + 7] = (width >> 8) & 0xff; bytes[offset + 8] = width & 0xff;
  return bytes;
}

describe("parseImageSize", () => {
  it("解析 PNG IHDR 宽高", () => {
    expect(parseImageSize(pngBytes(1200, 630))).toEqual({ width: 1200, height: 630 });
  });

  it("解析 JPEG SOF 宽高（跳过 APP 段）", () => {
    expect(parseImageSize(jpegBytes(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("解析 GIF 头", () => {
    const bytes = new Uint8Array(13);
    bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    bytes[6] = 0x20; bytes[7] = 0x03; // 800
    bytes[8] = 0xe0; bytes[9] = 0x01; // 480
    expect(parseImageSize(bytes)).toEqual({ width: 800, height: 480 });
  });

  it("解析 WebP VP8L（无损）", () => {
    // 宽 = 1 + ((b1&0x3f)<<8 | b0)，高 = 1 + ((b3&0x0f)<<10 | b2<<2 | (b1&0xc0)>>6)
    const bytes = new Uint8Array(30);
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12); // VP8L
    bytes[20] = 0x2f; // signature
    const width = 1200, height = 630;
    bytes[21] = ((width - 1) & 0xff);          // b0：宽低 8 位
    bytes[22] = (((width - 1) >> 8) & 0x3f) | ((((height - 1) & 0x3) << 6) & 0xff); // b1：宽高 6-7 位 | 高 0-1 位
    bytes[23] = (((height - 1) >> 2) & 0xff);  // b2：高 2-9 位
    bytes[24] = (((height - 1) >> 10) & 0x0f); // b3：高 10-13 位
    expect(parseImageSize(bytes)).toEqual({ width, height });
  });

  it("解析 WebP VP8X（扩展）", () => {
    const bytes = new Uint8Array(30);
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
    const width = 640, height = 480;
    bytes[24] = (width - 1) & 0xff; bytes[25] = ((width - 1) >> 8) & 0xff; bytes[26] = ((width - 1) >> 16) & 0xff;
    bytes[27] = (height - 1) & 0xff; bytes[28] = ((height - 1) >> 8) & 0xff; bytes[29] = ((height - 1) >> 16) & 0xff;
    expect(parseImageSize(bytes)).toEqual({ width, height });
  });

  it("无法识别或非法尺寸返回 null", () => {
    expect(parseImageSize(new Uint8Array(20))).toBeNull();
    expect(parseImageSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
