import { NextRequest, NextResponse } from "next/server";

import {
  addBannedWord,
  deleteAccount,
  deleteSubreddit,
  getAdminOverview,
  setUserStatus,
  warnUser,
} from "@/lib/admin";
import { reviewBusinessVerification } from "@/lib/businesses";
import { reviewChatMessageReport } from "@/lib/dm-moderation";
import { reviewListingReport } from "@/lib/marketplace";
import { listSiteSettings, setSiteSetting } from "@/lib/settings";
import { requireAdmin, type SessionUser } from "@/lib/permissions";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { jsonLocalizedError } from "@/lib/public-error";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession();
    await requireAdmin(session.user as SessionUser);
    const overview = await getAdminOverview();
    const settings = await listSiteSettings();
    return NextResponse.json({ ...overview, settings });
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("GET /api/admin failed", error);
    return await jsonLocalizedError("Failed to load admin overview", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const actor = await requireAdmin(session.user as SessionUser);
    const body = (await readApiJson(request)) as {
      op?: string;
      userId?: string;
      subredditId?: string;
      word?: string;
      severity?: "shadow" | "block";
      wordId?: string;
      message?: string;
      reason?: string;
      key?: string;
      value?: string;
      limit?: number;
      action?: "ban" | "unban" | "shadowban" | "unshadowban";
      reportId?: string;
      reportStatus?: "reviewed" | "dismissed";
      removeListing?: boolean;
      removeMessage?: boolean;
      resolutionNote?: string;
      verificationId?: string;
      verificationStatus?: "approved" | "rejected";
      verificationNote?: string;
    };

    switch (body.op) {
      case "user_status": {
        if (!body.userId || !body.action) {
          return await jsonLocalizedError("Missing fields", 400);
        }
        await setUserStatus({
          actorId: actor.id,
          targetUserId: body.userId,
          action: body.action,
          reason: body.reason,
        });
        return NextResponse.json({ ok: true });
      }
      case "warn": {
        if (!body.userId || !body.message) {
          return await jsonLocalizedError("Missing fields", 400);
        }
        const result = await warnUser({
          actorId: actor.id,
          targetUserId: body.userId,
          message: body.message,
        });
        return NextResponse.json(result, { status: 201 });
      }
      case "delete_account": {
        if (!body.userId) {
          return await jsonLocalizedError("Missing userId", 400);
        }
        await deleteAccount({
          actorId: actor.id,
          targetUserId: body.userId,
          reason: body.reason,
        });
        return NextResponse.json({ ok: true });
      }
      case "delete_subreddit": {
        if (!body.subredditId) {
          return await jsonLocalizedError("Missing subredditId", 400);
        }
        await deleteSubreddit({
          actorId: actor.id,
          subredditId: body.subredditId,
          reason: body.reason,
        });
        return NextResponse.json({ ok: true });
      }
      case "add_banned_word": {
        if (!body.word || !body.severity) {
          return await jsonLocalizedError("Missing fields", 400);
        }
        const result = await addBannedWord({
          actorId: actor.id,
          word: body.word,
          severity: body.severity,
        });
        return NextResponse.json(result, { status: 201 });
      }
      case "remove_banned_word": {
        if (!body.wordId) {
          return await jsonLocalizedError("Missing wordId", 400);
        }
        const { removeBannedWord } = await import("@/lib/admin");
        await removeBannedWord(body.wordId);
        return NextResponse.json({ ok: true });
      }
      case "review_listing_report": {
        if (
          !body.reportId ||
          !body.reportStatus ||
          !["reviewed", "dismissed"].includes(body.reportStatus)
        ) {
          return await jsonLocalizedError("Missing listing report fields", 400);
        }
        const result = await reviewListingReport({
          reportId: body.reportId,
          reviewerId: actor.id,
          status: body.reportStatus,
          removeListing: body.removeListing,
          resolutionNote: body.resolutionNote,
        });
        return NextResponse.json(result);
      }
      case "review_chat_message_report": {
        if (
          !body.reportId ||
          !body.reportStatus ||
          !["reviewed", "dismissed"].includes(body.reportStatus)
        ) {
          return await jsonLocalizedError("Missing chat report fields", 400);
        }
        const result = await reviewChatMessageReport({
          reportId: body.reportId,
          reviewerId: actor.id,
          status: body.reportStatus,
          removeMessage: body.removeMessage,
          resolutionNote: body.resolutionNote,
        });
        return NextResponse.json(result);
      }
      case "review_business_verification": {
        if (
          !body.verificationId ||
          !body.verificationStatus ||
          !["approved", "rejected"].includes(body.verificationStatus)
        ) {
          return await jsonLocalizedError(
            "Missing business verification fields",
            400
          );
        }
        const result = await reviewBusinessVerification({
          requestId: body.verificationId,
          reviewerId: actor.id,
          status: body.verificationStatus,
          resolutionNote: body.verificationNote,
        });
        return NextResponse.json(result);
      }
      case "backfill_embeddings": {
        const { backfillPostEmbeddings } = await import("@/lib/embeddings");
        const result = await backfillPostEmbeddings(
          typeof body.limit === "number" ? body.limit : 100
        );
        return NextResponse.json(result);
      }
      case "backfill_translations": {
        const { backfillContentTranslations } = await import("@/lib/translation");
        const result = await backfillContentTranslations(
          typeof body.limit === "number" ? body.limit : 100
        );
        return NextResponse.json(result);
      }
      case "set_setting": {
        if (
          typeof body.key !== "string" ||
          !/^[a-z0-9_]{2,80}$/.test(body.key) ||
          typeof body.value !== "string" ||
          body.value.length > 500
        ) {
          return await jsonLocalizedError("Invalid setting", 400);
        }
        const value = body.value.trim();
        if (body.key === "ads_enabled" && !["0", "1"].includes(value)) {
          return await jsonLocalizedError("ads_enabled must be 0 or 1", 400);
        }
        await setSiteSetting(body.key, value, actor.id);
        return NextResponse.json({ ok: true });
      }
      case "list_ads": {
        const { listAdCampaigns } = await import("@/lib/ads");
        return NextResponse.json({ campaigns: await listAdCampaigns() });
      }
      case "create_ad": {
        const { createAdCampaign } = await import("@/lib/ads");
        const adBody = body as {
          name?: string;
          placement?: "feed_inline" | "sidebar" | "post_footer";
          targetUrl?: string;
          adBody?: string;
          weight?: number;
          status?: "draft" | "active" | "paused" | "ended";
        };
        if (!adBody.name || !adBody.placement || !adBody.targetUrl) {
          return await jsonLocalizedError("Missing fields", 400);
        }
        const id = await createAdCampaign({
          name: adBody.name,
          placement: adBody.placement,
          targetUrl: adBody.targetUrl,
          body: adBody.adBody,
          weight: adBody.weight,
          status: adBody.status ?? "draft",
          createdBy: actor.id,
        });
        return NextResponse.json({ id }, { status: 201 });
      }
      case "update_ad": {
        const { updateAdCampaign } = await import("@/lib/ads");
        const adBody = body as {
          campaignId?: string;
          status?: "draft" | "active" | "paused" | "ended";
          name?: string;
          weight?: number;
          adBody?: string | null;
          targetUrl?: string;
        };
        if (!adBody.campaignId) {
          return await jsonLocalizedError("Missing campaignId", 400);
        }
        await updateAdCampaign({
          id: adBody.campaignId,
          status: adBody.status,
          name: adBody.name,
          weight: adBody.weight,
          body: adBody.adBody,
          targetUrl: adBody.targetUrl,
        });
        return NextResponse.json({ ok: true });
      }
      case "ad_stats": {
        const { getAdCampaignStats } = await import("@/lib/ads");
        const campaignId = (body as { campaignId?: string }).campaignId;
        if (!campaignId) {
          return await jsonLocalizedError("Missing campaignId", 400);
        }
        return NextResponse.json(await getAdCampaignStats(campaignId));
      }
      default:
        return await jsonLocalizedError("Unknown op", 400);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return await jsonAuthError(error);
    }
    console.error("POST /api/admin failed", error);
    return await jsonLocalizedError("Admin action failed", 500);
  }
}
