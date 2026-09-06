import { describe, expect, it } from "vitest";

import {
  accountTrustFactor,
  computeHotScore,
  displayScore,
  effectiveVoteWeight,
  signedVoteContribution,
  sourceTrustFactor,
  velocityFactor,
  voteWeight,
} from "@/lib/vote-weight";

describe("voteWeight", () => {
  it("keeps a fixed baseline with upvotes stronger than downvotes", () => {
    expect(voteWeight("upvote")).toBe(100);
    expect(voteWeight("downvote")).toBe(40);
    expect(voteWeight("upvote")).toBeGreaterThan(voteWeight("downvote"));
  });

  it("does not make new or negative reputation mute a baseline vote", () => {
    expect(voteWeight("upvote")).toBe(100);
    expect(voteWeight("downvote")).toBe(40);
  });

  it("converts millipoints to display score", () => {
    expect(displayScore(100)).toBe(1);
    expect(displayScore(140)).toBe(1);
    expect(displayScore(5)).toBe(0);
  });

  it("signs contributions by action", () => {
    expect(signedVoteContribution("upvote", 40)).toBe(40);
    expect(signedVoteContribution("downvote", 16)).toBe(-16);
  });
});

describe("score integrity", () => {
  it("damps downvote floods harder than upvote floods", () => {
    const up = velocityFactor({
      action: "upvote",
      recentSameDirection: 20,
    });
    const down = velocityFactor({
      action: "downvote",
      recentSameDirection: 20,
    });
    expect(down).toBeLessThan(up);
    expect(up).toBeLessThan(1);
  });

  it("trusts organic discovery more than direct/shared", () => {
    expect(sourceTrustFactor("home")).toBeGreaterThan(
      sourceTrustFactor("direct")
    );
    expect(sourceTrustFactor("community")).toBeGreaterThan(
      sourceTrustFactor("unknown")
    );
  });

  it("penalizes brand-new single-target voters", () => {
    const young = accountTrustFactor({
      accountAgeHours: 1,
      votesOnOtherTargets: 0,
    });
    const mature = accountTrustFactor({
      accountAgeHours: 500,
      votesOnOtherTargets: 20,
    });
    expect(young).toBeLessThan(mature);
  });

  it("keeps a new account vote meaningful while allowing contextual damping", () => {
    const fresh = effectiveVoteWeight({
      action: "upvote",
      discoverySource: "unknown",
      hasPriorView: false,
      recentSameDirection: 0,
      accountAgeHours: 0,
      votesOnOtherTargets: 0,
    });
    expect(fresh).toBeGreaterThanOrEqual(15);
    expect(
      effectiveVoteWeight({
        action: "upvote",
        discoverySource: "unknown",
        hasPriorView: false,
        recentSameDirection: 20,
        accountAgeHours: 0,
        votesOnOtherTargets: 0,
      })
    ).toBeLessThan(fresh);
  });

  it("reduces effective weight for inorganic upvote spikes", () => {
    const organic = effectiveVoteWeight({
      action: "upvote",
      discoverySource: "home",
      hasPriorView: true,
      recentSameDirection: 0,
      accountAgeHours: 400,
      votesOnOtherTargets: 50,
    });
    const inorganic = effectiveVoteWeight({
      action: "upvote",
      discoverySource: "direct",
      hasPriorView: false,
      recentSameDirection: 25,
      accountAgeHours: 2,
      votesOnOtherTargets: 0,
    });
    expect(inorganic).toBeLessThan(organic);
  });

  it("computes log-damped hot scores", () => {
    const fresh = computeHotScore(500, 1);
    const old = computeHotScore(500, 48);
    expect(fresh).toBeGreaterThan(old);
    expect(computeHotScore(-200, 2)).toBeLessThan(0);
  });
});
