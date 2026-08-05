import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MiB
const MAX_DIMENSION = 2048;
const MIN_QUALITY = 0.45;
const START_QUALITY = 0.82;

export type ImageFormat = "jpeg" | "png" | "webp";

const DANGEROUS_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*\/\s*script\s*>/i,
  /<\?php\b/i,
  /<\?=/i,
  /<%[\s=]/,
  /<\s*svg\b/i,
  /<\s*html\b/i,
  /<\s*body\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<!DOCTYPE\s+html/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
  /\bon\w+\s*=/i,
];

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;

  // JPEG SOI
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // PNG signature
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // RIFF....WEBP
  const riff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const webp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (riff && webp) {
    return "webp";
  }

  return null;
}

/** Reject HTML/JS/PHP polyglots and other dangerous embedded fragments. */
export function assertNoDangerousFragments(bytes: Uint8Array): void {
  const sample = bytes.subarray(0, Math.min(bytes.length, 256 * 1024));
  const text = new TextDecoder("latin1").decode(sample);

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("Image failed security check");
    }
  }

  // Leading whitespace + markup is a classic sniffer polyglot
  const head = text.slice(0, 64).trimStart().toLowerCase();
  if (
    head.startsWith("<!") ||
    head.startsWith("<?") ||
    head.startsWith("<html") ||
    head.startsWith("<svg") ||
    head.startsWith("<script")
  ) {
    throw new Error("Image failed security check");
  }
}

function assertNoTrailingPayload(
  bytes: Uint8Array,
  endExclusive: number,
  label: string
): void {
  if (endExclusive < 0 || endExclusive > bytes.length) {
    throw new Error(`Corrupt ${label} image`);
  }
  for (let i = endExclusive; i < bytes.length; i++) {
    if (bytes[i] !== 0x00) {
      throw new Error("Image contains trailing dangerous data");
    }
  }
}

function findJpegEnd(bytes: Uint8Array): number {
  for (let i = bytes.length - 2; i >= 0; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      return i + 2;
    }
  }
  throw new Error("Corrupt JPEG image");
}

function findPngEnd(bytes: Uint8Array): number {
  // IEND chunk: length(0) + "IEND" + CRC
  for (let i = 0; i + 8 <= bytes.length; i++) {
    if (
      bytes[i] === 0x49 &&
      bytes[i + 1] === 0x45 &&
      bytes[i + 2] === 0x4e &&
      bytes[i + 3] === 0x44
    ) {
      // "IEND" starts after 4-byte length; full chunk is 12 bytes from length start
      const chunkStart = i - 4;
      if (chunkStart < 0) continue;
      return chunkStart + 12;
    }
  }
  throw new Error("Corrupt PNG image");
}

function findWebpEnd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffSize = view.getUint32(4, true);
  return 8 + riffSize;
}

export function assertContainerIntegrity(
  bytes: Uint8Array,
  format: ImageFormat
): void {
  if (format === "jpeg") {
    assertNoTrailingPayload(bytes, findJpegEnd(bytes), "JPEG");
    return;
  }
  if (format === "png") {
    assertNoTrailingPayload(bytes, findPngEnd(bytes), "PNG");
    return;
  }
  const end = findWebpEnd(bytes);
  if (end > bytes.length) {
    throw new Error("Corrupt WebP image");
  }
  assertNoTrailingPayload(bytes, end, "WebP");
}

/** Strip JPEG APP/COM segments (EXIF, XMP, ICC, comments) while keeping image data. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Corrupt JPEG image");
  }

  const out: number[] = [0xff, 0xd8];
  let i = 2;

  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) {
      throw new Error("Corrupt JPEG image");
    }

    // Skip fill bytes
    while (i < bytes.length && bytes[i] === 0xff) {
      i++;
    }
    if (i >= bytes.length) break;

    const marker = bytes[i]!;
    i++;

    // Standalone markers without length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      if (marker === 0xd9) {
        out.push(0xff, 0xd9);
        break;
      }
      out.push(0xff, marker);
      continue;
    }

    if (i + 1 >= bytes.length) {
      throw new Error("Corrupt JPEG image");
    }
    const length = (bytes[i]! << 8) | bytes[i + 1]!;
    if (length < 2 || i + length > bytes.length) {
      throw new Error("Corrupt JPEG image");
    }

    const isSos = marker === 0xda;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isCom = marker === 0xfe;

    if (isSos) {
      out.push(0xff, marker);
      for (let j = 0; j < length; j++) {
        out.push(bytes[i + j]!);
      }
      i += length;
      // Entropy-coded scan until EOI (copy rest, then trim at EOI)
      const rest = bytes.subarray(i);
      const eoi = findJpegEnd(rest);
      for (let j = 0; j < eoi; j++) {
        out.push(rest[j]!);
      }
      break;
    }

    if (!isApp && !isCom) {
      out.push(0xff, marker);
      for (let j = 0; j < length; j++) {
        out.push(bytes[i + j]!);
      }
    }

    i += length;
  }

  return Uint8Array.from(out);
}

/** Drop ancillary PNG chunks that often carry metadata or text payloads. */
export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (detectImageFormat(bytes) !== "png") {
    throw new Error("Corrupt PNG image");
  }

  const drop = new Set([
    "tEXt",
    "zTXt",
    "iTXt",
    "eXIf",
    "tIME",
    "dSIG",
    "iCCP",
    "pHYs",
  ]);

  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    out.push(bytes[i]!);
  }

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length =
      (bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!;
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!
    );
    const chunkTotal = 12 + length;
    if (offset + chunkTotal > bytes.length) {
      throw new Error("Corrupt PNG image");
    }

    if (!drop.has(type)) {
      for (let i = 0; i < chunkTotal; i++) {
        out.push(bytes[offset + i]!);
      }
    }

    offset += chunkTotal;
    if (type === "IEND") break;
  }

  return Uint8Array.from(out);
}

/** Remove EXIF/XMP/ICCP (and similar) chunks from a WebP RIFF container. */
export function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (detectImageFormat(bytes) !== "webp") {
    throw new Error("Corrupt WebP image");
  }

  const drop = new Set(["EXIF", "XMP ", "ICCP"]);
  const chunks: Uint8Array[] = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!
    );
    const size =
      bytes[offset + 4]! |
      (bytes[offset + 5]! << 8) |
      (bytes[offset + 6]! << 16) |
      (bytes[offset + 7]! << 24);
    const payloadStart = offset + 8;
    const padded = size + (size & 1);
    if (payloadStart + padded > bytes.length) {
      throw new Error("Corrupt WebP image");
    }

    if (!drop.has(fourcc)) {
      chunks.push(bytes.subarray(offset, payloadStart + padded));
    }

    offset = payloadStart + padded;
  }

  let payloadSize = 4; // "WEBP"
  for (const chunk of chunks) {
    payloadSize += chunk.length;
  }

  const out = new Uint8Array(8 + payloadSize);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  out[4] = payloadSize & 0xff;
  out[5] = (payloadSize >> 8) & 0xff;
  out[6] = (payloadSize >> 16) & 0xff;
  out[7] = (payloadSize >> 24) & 0xff;
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP

  let cursor = 12;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }

  return out;
}

type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
};

function decodeJpeg(bytes: Uint8Array): RgbaImage {
  const decoded = jpeg.decode(Buffer.from(bytes), {
    useTArray: true,
    formatAsRGBA: true,
  });
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8Array(decoded.data),
  };
}

function decodePng(bytes: Uint8Array): RgbaImage {
  const png = PNG.sync.read(Buffer.from(bytes));
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data),
  };
}

function resizeImage(image: RgbaImage, maxDim: number): RgbaImage {
  const largest = Math.max(image.width, image.height);
  if (largest <= maxDim) {
    return image;
  }

  const scale = maxDim / largest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(image.width - 1, Math.floor(x / scale));
      const src = (srcY * image.width + srcX) * 4;
      const dst = (y * width + x) * 4;
      data[dst] = image.data[src]!;
      data[dst + 1] = image.data[src + 1]!;
      data[dst + 2] = image.data[src + 2]!;
      data[dst + 3] = image.data[src + 3]!;
    }
  }

  return { width, height, data };
}

function encodeJpeg(image: RgbaImage, quality: number): Uint8Array {
  const encoded = jpeg.encode(
    {
      width: image.width,
      height: image.height,
      data: Buffer.from(image.data),
    },
    Math.round(quality * 100)
  );
  return new Uint8Array(encoded.data);
}

/**
 * Security-scan, strip metadata, re-encode (compression + EXIF removal),
 * and enforce the 1 MiB output budget.
 *
 * WebP is accepted after strip/security checks but not re-encoded (no pure-JS
 * encoder); oversized WebP is rejected.
 */
export function processUploadedImage(bytes: Uint8Array): {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/webp";
  extension: "jpg" | "webp";
} {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be under 1 MB");
  }

  const format = detectImageFormat(bytes);
  if (!format) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed");
  }

  assertNoDangerousFragments(bytes);
  assertContainerIntegrity(bytes, format);

  if (format === "webp") {
    const cleaned = stripWebpMetadata(bytes);
    assertNoDangerousFragments(cleaned);
    if (cleaned.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Image must be under 1 MB after processing");
    }
    return {
      bytes: cleaned,
      contentType: "image/webp",
      extension: "webp",
    };
  }

  const stripped =
    format === "jpeg" ? stripJpegMetadata(bytes) : stripPngMetadata(bytes);
  assertNoDangerousFragments(stripped);

  let image =
    format === "jpeg" ? decodeJpeg(stripped) : decodePng(stripped);
  image = resizeImage(image, MAX_DIMENSION);

  let quality = START_QUALITY;
  let encoded = encodeJpeg(image, quality);

  while (encoded.byteLength > MAX_UPLOAD_BYTES && quality > MIN_QUALITY) {
    quality -= 0.08;
    encoded = encodeJpeg(image, quality);
  }

  if (encoded.byteLength > MAX_UPLOAD_BYTES) {
    // Last resort: shrink further
    image = resizeImage(image, Math.floor(MAX_DIMENSION * 0.7));
    encoded = encodeJpeg(image, MIN_QUALITY);
  }

  if (encoded.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be under 1 MB after compression");
  }

  assertNoDangerousFragments(encoded);
  assertContainerIntegrity(encoded, "jpeg");

  return {
    bytes: encoded,
    contentType: "image/jpeg",
    extension: "jpg",
  };
}
