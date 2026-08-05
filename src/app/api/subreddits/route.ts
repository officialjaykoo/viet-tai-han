import { NextRequest, NextResponse } from "next/server";

import { createSubreddit } from "@/lib/actions";
import { listSubreddits } from "@/lib/content";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const communities = await listSubreddits(100);
    return NextResponse.json({ communities });
  } catch (error) {
    console.error("GET /api/subreddits failed", error);
    return await jsonLocalizedError("Failed to list communities", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const user = session.user as {
      id: string;
      status?: string | null;
      karma?: number | null;
      role?: string | null;
      username?: string | null;
      name?: string;
      email?: string;
    };
    const { requireCanCreateCommunity } = await import("@/lib/permissions");
    await requireCanCreateCommunity({
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      status: user.status,
      karma: user.karma,
      role: user.role,
      username: user.username,
    });

    const body = (await readApiJson(request)) as {
      name?: string;
      title?: string;
      description?: string;
    };

    if (!body.name || !body.title) {
      return await jsonLocalizedError("name and title are required", 400);
    }

    const result = await createSubreddit({
      userId: session.user.id,
      name: body.name,
      title: body.title,
      description: body.description,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/subreddits failed", error);
    return await jsonLocalizedError("Failed to create community", 500);
  }
}
