import { NextResponse } from "next/server";

import { getMediaObject, isAllowedMediaKey } from "@/lib/media";
import { jsonLocalizedError } from "@/lib/public-error";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] | string }> }
) {
  try {
    const { key: parts } = await context.params;
    const key = (Array.isArray(parts) ? parts : [parts])
      .map(decodeURIComponent)
      .join("/");

    if (!isAllowedMediaKey(key)) {
      return await jsonLocalizedError("Not found", 404);
    }

    const object = await getMediaObject(key);
    if (!object) {
      return await jsonLocalizedError("Not found", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(object.body, { headers });
  } catch (error) {
    console.error("GET /api/media/[...key] failed", error);
    return await jsonLocalizedError("Not found", 404);
  }
}
