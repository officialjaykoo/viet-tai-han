const MAX_BYTES = 1 * 1024 * 1024;
const MAX_DIM = 2048;

/**
 * Browser-side prep so oversized camera photos can still be posted.
 * Server still re-encodes, strips metadata, and security-scans.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not process image");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.85;
    let blob: Blob | null = null;
    while (quality >= 0.45) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= MAX_BYTES) break;
      quality -= 0.1;
    }

    if (!blob || blob.size > MAX_BYTES) {
      throw new Error("Image must be under 1 MB after compression");
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
