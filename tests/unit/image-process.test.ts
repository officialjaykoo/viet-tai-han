import { describe, expect, it } from "vitest";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import {
  assertNoDangerousFragments,
  assertSourceImageDimensions,
  detectImageFormat,
  processUploadedImage,
  stripJpegMetadata,
} from "@/lib/image-process";

function makeJpeg(width = 32, height = 32, quality = 90): Uint8Array {
  const data = Buffer.alloc(width * height * 4, 120);
  const encoded = jpeg.encode({ width, height, data }, quality);
  return new Uint8Array(encoded.data);
}

function makePng(width = 24, height = 24): Uint8Array {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 200;
    png.data[i + 1] = 40;
    png.data[i + 2] = 40;
    png.data[i + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

function makeJpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}
function makePngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function makeWebpVp8xHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(12 + 8 + 10);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00], 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >>> 8) & 0xff;
  bytes[26] = encodedWidth >>> 16;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >>> 8) & 0xff;
  bytes[29] = encodedHeight >>> 16;
  return bytes;
}


describe("image-process", () => {
  it("detects jpeg and png magic bytes", () => {
    expect(detectImageFormat(makeJpeg())).toBe("jpeg");
    expect(detectImageFormat(makePng())).toBe("png");
    expect(detectImageFormat(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });

  it("rejects script polyglots", () => {
    const jpegBytes = makeJpeg();
    const poisoned = new Uint8Array(jpegBytes.length + 20);
    poisoned.set(jpegBytes);
    // Overwrite start with HTML while keeping some jpeg-looking bytes later —
    // use a pure HTML payload that claims to be an upload.
    const html = new TextEncoder().encode(
      "<script>alert(1)</script>\xff\xd8\xff"
    );
    expect(() => assertNoDangerousFragments(html)).toThrow(/security/i);
  });

  it("rejects trailing payload after JPEG EOI", () => {
    const jpegBytes = makeJpeg();
    const payload = new TextEncoder().encode("<script>x</script>");
    const trailing = new Uint8Array(jpegBytes.length + payload.length);
    trailing.set(jpegBytes);
    trailing.set(payload, jpegBytes.length);
    expect(() => processUploadedImage(trailing)).toThrow();
  });

  it("strips JPEG APP metadata segments", () => {
    const base = makeJpeg();
    // Insert a fake APP1 (EXIF) segment after SOI
    const app1 = new Uint8Array([
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    ]);
    const withExif = new Uint8Array(2 + app1.length + (base.length - 2));
    withExif[0] = 0xff;
    withExif[1] = 0xd8;
    withExif.set(app1, 2);
    withExif.set(base.subarray(2), 2 + app1.length);

    const stripped = stripJpegMetadata(withExif);
    expect(detectImageFormat(stripped)).toBe("jpeg");
    // APP1 marker should be gone
    expect(Buffer.from(stripped).includes(Buffer.from("Exif"))).toBe(false);
  });

  it("re-encodes PNG to compressed JPEG under 1MB", () => {
    const result = processUploadedImage(makePng(64, 64));
    expect(result.extension).toBe("jpg");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.bytes.byteLength).toBeLessThanOrEqual(1024 * 1024);
    expect(detectImageFormat(result.bytes)).toBe("jpeg");
  });

  it("rejects oversized uploads", () => {
    const huge = new Uint8Array(1024 * 1024 + 1);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    expect(() => processUploadedImage(huge)).toThrow(/1 MB/i);
  });
  it("rejects JPEG dimensions before decode", () => {
    const bomb = makeJpegHeader(8193, 1);
    expect(() => processUploadedImage(bomb)).toThrow(/dimensions/i);
    expect(() =>
      assertSourceImageDimensions(makeJpegHeader(8192, 8192), "jpeg")
    ).toThrow(/dimensions/i);
  });

  it("accepts safe JPEG dimensions from the header", () => {
    expect(() =>
      assertSourceImageDimensions(makeJpegHeader(8192, 1), "jpeg")
    ).not.toThrow();
  });
  it("rejects oversized PNG and WebP dimensions from headers", () => {
    expect(() =>
      assertSourceImageDimensions(makePngHeader(8193, 1), "png")
    ).toThrow(/dimensions/i);
    expect(() =>
      assertSourceImageDimensions(makeWebpVp8xHeader(8193, 1), "webp")
    ).toThrow(/dimensions/i);
  });
});
