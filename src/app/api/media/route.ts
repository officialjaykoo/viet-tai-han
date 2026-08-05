import { NextRequest, NextResponse } from "next/server";

import { uploadPostImage } from "@/lib/media";
import { jsonLocalizedError } from "@/lib/public-error";
import { requireSignedHeaders } from "@/lib/security/guard";
import { getTunnelContext } from "@/lib/security/tunnel-context";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireSignedHeaders(request);
    const session = await requireSession();

    const tunnel = getTunnelContext();
    let file: File;

    if (tunnel?.verified && tunnel.raw.byteLength > 0) {
      const type = tunnel.contentType || "application/octet-stream";
      const name = tunnel.filename || "upload.bin";
      file = new File([new Uint8Array(tunnel.raw)], name, { type });
    } else {
      const form = await request.formData();
      const value = form.get("file");
      if (!(value instanceof File)) {
        return await jsonLocalizedError("file is required", 400);
      }
      file = value;
    }

    const result = await uploadPostImage({
      userId: session.user.id,
      file,
    });

    return NextResponse.json(
      {
        mediaKey: result.mediaKey,
        // Logical path only — never a browser-fetchable URL; clients load via /i/api.
        path: `/api/media/${result.mediaKey}`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/media failed", error);
    return await jsonLocalizedError("Upload failed", 500);
  }
}
