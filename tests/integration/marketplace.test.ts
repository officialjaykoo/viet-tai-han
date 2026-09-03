import { describe, expect, it } from "vitest";

import {
  createListing,
  createListingAlert,
  deleteListingAlert,
  getListingDetail,
  listListingAlerts,
  listListingReportQueue,
  listSavedListings,
  listListings,
  reportListing,
  reviewListingReport,
  toggleListingSave,
  updateListingStatus,
} from "@/lib/marketplace";
import { AuthError } from "@/lib/session";
import { searchAll } from "@/lib/search";
import { seedUsersAndSubreddit } from "./helpers";

describe("marketplace lifecycle (D1)", () => {
  it("creates, filters, saves, and changes listing status", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    const listing = await createListing({
      sellerId: authorId,
      sellerStatus: "active",
      kind: "market",
      category: "Furniture",
      title: "Compact desk for a Seoul room",
      body: "Clean compact desk with a drawer, available for pickup near the station.",
      price: "50000 KRW",
      location: "Seoul, Mapo-gu",
    });

    expect(listing.id).toBeTruthy();
    const listed = await listListings({
      query: "compact desk",
      viewerUserId: authorId,
    });
    expect(listed.some((item) => item.id === listing.id)).toBe(true);

    const detail = await getListingDetail(listing.id, authorId);
    expect(detail?.seller.isOwner).toBe(true);
    expect(detail?.saved).toBe(false);

    expect(await toggleListingSave({ listingId: listing.id, userId: authorId })).toEqual({
      saved: true,
    });
    expect((await listSavedListings(authorId)).some((item) => item.id === listing.id)).toBe(
      true
    );

    await expect(
      updateListingStatus({
        listingId: listing.id,
        sellerId: voterId,
        status: "sold",
      })
    ).rejects.toBeInstanceOf(AuthError);

    await updateListingStatus({
      listingId: listing.id,
      sellerId: authorId,
      status: "sold",
    });
    expect((await getListingDetail(listing.id, authorId))?.status).toBe("sold");
    await expect(
      updateListingStatus({
        listingId: listing.id,
        sellerId: authorId,
        status: "sold",
      })
    ).resolves.toEqual({ status: "sold" });

    const search = await searchAll("compact desk");
    expect(search.listings.some((item) => item.id === listing.id)).toBe(true);
  });

  it("rejects public contact details and duplicate reports", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    await expect(
      createListing({
        sellerId: authorId,
        sellerStatus: "active",
        kind: "service",
        category: "Translation",
        title: "Translation help email me@example.com",
        body: "I can help with short documents and common forms.",
        location: "Incheon",
      })
    ).rejects.toBeInstanceOf(AuthError);

    const listing = await createListing({
      sellerId: authorId,
      sellerStatus: "active",
      kind: "service",
      category: "Translation",
      title: "Vietnamese and Korean document help",
      body: "Describe the document type and deadline through a private message.",
      location: "Incheon",
    });

    await expect(
      reportListing({
        listingId: listing.id,
        reporterId: authorId,
        reason: "scam",
      })
    ).rejects.toBeInstanceOf(AuthError);

    await reportListing({
      listingId: listing.id,
      reporterId: voterId,
      reason: "misleading",
      details: "The service description needs moderator review.",
    });
    await expect(
      reportListing({
        listingId: listing.id,
        reporterId: voterId,
        reason: "misleading",
      })
    ).rejects.toBeInstanceOf(AuthError);

    const report = (await listListingReportQueue()).find(
      (item) => item.listingId === listing.id
    );
    expect(report?.id).toBeTruthy();
    await reviewListingReport({
      reportId: report!.id,
      reviewerId: authorId,
      status: "reviewed",
      removeListing: true,
      resolutionNote: "Removed after review.",
    });
    expect(await getListingDetail(listing.id, voterId)).toBeNull();
  });

  it("creates, lists, and deletes search alerts", async () => {
    const { authorId } = await seedUsersAndSubreddit();
    const created = await createListingAlert({
      userId: authorId,
      query: "restaurant",
      kind: "job",
      location: "Seoul",
    });
    expect(created.id).toBeTruthy();
    expect((await listListingAlerts(authorId)).some((item) => item.id === created.id)).toBe(
      true
    );

    await deleteListingAlert({ userId: authorId, alertId: created.id });
    expect((await listListingAlerts(authorId)).some((item) => item.id === created.id)).toBe(
      false
    );
  });
});
