import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  createBusiness,
  createBusinessBooking,
  getBusinessDetail,
  listBusinessBookings,
  listBusinesses,
  listBusinessVerificationQueue,
  reviewBusinessVerification,
  submitBusinessVerification,
  updateBusiness,
  updateBusinessBooking,
} from "@/lib/businesses";
import { AuthError } from "@/lib/session";
import { seedUsersAndSubreddit } from "./helpers";

describe("business lifecycle (D1)", () => {
  it("creates, edits, submits, reviews, and discovers a business", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();

    await expect(
      createBusiness({
        ownerId: authorId,
        ownerStatus: "active",
        name: "Invalid business URL",
        description: "A business profile with a rejected URL scheme.",
        category: "Translation",
        address: "Seoul",
        location: "Seoul",
        websiteUrl: "javascript:alert(1)",
      })
    ).rejects.toBeInstanceOf(AuthError);

    const created = await createBusiness({
      ownerId: authorId,
      ownerStatus: "active",
      name: "Viet House Seoul",
      description: "A Vietnamese community business for meals and local support.",
      category: "Restaurant",
      address: "Seoul, Mapo-gu",
      location: "Seoul",
      websiteUrl: "https://example.com/viet-house",
      services: [
        {
          name: "Lunch set",
          description: "A Vietnamese lunch set.",
          price: "12000 KRW",
          durationMinutes: 60,
        },
      ],
    });
    expect(created.id).toBeTruthy();
    expect(created.slug).toBe("viet-house-seoul");

    const ownerDetail = await getBusinessDetail(created.id, authorId);
    expect(ownerDetail?.owner.isOwner).toBe(true);
    expect(ownerDetail?.verificationStatus).toBe("unverified");
    expect(ownerDetail?.services).toHaveLength(1);

    expect(await getBusinessDetail(created.id, voterId)).toBeNull();
    expect(
      (await listBusinesses({ query: "Viet House" })).some((item) => item.id === created.id)
    ).toBe(false);

    await expect(
      updateBusiness({
        businessId: created.id,
        ownerId: voterId,
        name: "Unauthorized edit",
        description: "This edit must be rejected.",
        category: "Restaurant",
        address: "Seoul",
        location: "Seoul",
      })
    ).rejects.toBeInstanceOf(AuthError);

    await updateBusiness({
      businessId: created.id,
      ownerId: authorId,
      name: "Viet House Seoul Updated",
      description: "Updated Vietnamese meals and local support for the community.",
      category: "Restaurant",
      address: "Seoul, Mapo-gu",
      location: "Seoul",
      openingHours: "Mon-Sat 11:00-21:00",
      services: [
        {
          name: "Consultation",
          description: "A short support consultation.",
          price: "20000 KRW",
          durationMinutes: 30,
        },
      ],
    });
    const updated = await getBusinessDetail(created.slug, authorId);
    expect(updated?.name).toBe("Viet House Seoul Updated");
    expect(updated?.services[0]?.name).toBe("Consultation");

    const verification = await submitBusinessVerification({
      businessId: created.id,
      ownerId: authorId,
      evidence:
        "Business registration and address evidence are available for moderator review.",
    });
    expect(verification.status).toBe("pending");
    await expect(
      submitBusinessVerification({
        businessId: created.id,
        ownerId: authorId,
        evidence: "This duplicate request should not be accepted.",
      })
    ).rejects.toBeInstanceOf(AuthError);

    const queueItem = (await listBusinessVerificationQueue()).find(
      (item) => item.id === verification.id
    );
    expect(queueItem?.businessSlug).toBe(created.slug);
    expect(queueItem?.ownerUsername).toContain("author_");

    await reviewBusinessVerification({
      requestId: verification.id,
      reviewerId: voterId,
      status: "approved",
      resolutionNote: "Evidence reviewed.",
    });
    await expect(
      reviewBusinessVerification({
        requestId: verification.id,
        reviewerId: voterId,
        status: "approved",
      })
    ).rejects.toBeInstanceOf(AuthError);

    const publicDetail = await getBusinessDetail(created.slug);
    expect(publicDetail?.verificationStatus).toBe("verified");
    expect(
      (await listBusinesses({ query: "Viet House", location: "Seoul" })).some(
        (item) => item.id === created.id
      )
    ).toBe(true);
  });

  it("creates, confirms, conflicts, and cancels booking requests", async () => {
    const { authorId, voterId } = await seedUsersAndSubreddit();
    const competitorId = `u_competitor_${crypto.randomUUID().slice(0, 8)}`;
    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
       VALUES (?, 'Competitor', ?, 1, ?, 30, 'user', 'active')`
    )
      .bind(competitorId, `${competitorId}@test.local`, `competitor_${competitorId.slice(-8)}`)
      .run();

    const business = await createBusiness({
      ownerId: authorId,
      ownerStatus: "active",
      name: "Booking House",
      description: "A verified business used to test booking requests.",
      category: "Consulting",
      address: "Seoul, Jung-gu",
      location: "Seoul",
      services: [
        {
          name: "One hour appointment",
          description: "A scheduled appointment.",
          price: "30000 KRW",
          durationMinutes: 60,
        },
      ],
    });
    const detail = await getBusinessDetail(business.id, authorId);
    const serviceId = detail?.services[0]?.id;
    expect(serviceId).toBeTruthy();

    const verification = await submitBusinessVerification({
      businessId: business.id,
      ownerId: authorId,
      evidence: "Registration and location evidence for the booking test business.",
    });
    await reviewBusinessVerification({
      requestId: verification.id,
      reviewerId: voterId,
      status: "approved",
    });

    const startAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const first = await createBusinessBooking({
      businessId: business.id,
      requesterId: voterId,
      serviceId,
      startAt,
      note: "Please confirm this appointment.",
    });
    expect(first.status).toBe("requested");
    expect((await listBusinessBookings({ businessId: business.id, viewerUserId: authorId }))[0])
      .toMatchObject({
        id: first.id,
        isOwner: true,
        status: "requested",
        serviceId,
      });
    expect((await listBusinessBookings({ businessId: business.id, viewerUserId: voterId }))[0])
      .toMatchObject({ id: first.id, isOwner: false, status: "requested" });

    await updateBusinessBooking({
      bookingId: first.id,
      viewerUserId: authorId,
      status: "confirmed",
      ownerNote: "Confirmed for the requested time.",
    });
    expect(
      (await listBusinessBookings({ businessId: business.id, viewerUserId: voterId })).find(
        (item) => item.id === first.id
      )
    ).toMatchObject({ status: "confirmed", ownerNote: "Confirmed for the requested time." });

    await expect(
      createBusinessBooking({
        businessId: business.id,
        requesterId: competitorId,
        serviceId,
        startAt,
      })
    ).rejects.toBeInstanceOf(AuthError);

    await expect(
      updateBusinessBooking({
        bookingId: first.id,
        viewerUserId: voterId,
        status: "completed",
      })
    ).rejects.toBeInstanceOf(AuthError);
    await updateBusinessBooking({
      bookingId: first.id,
      viewerUserId: voterId,
      status: "cancelled",
    });
    expect(
      (await listBusinessBookings({ businessId: business.id, viewerUserId: voterId })).find(
        (item) => item.id === first.id
      )?.status
    ).toBe("cancelled");
  });
});
