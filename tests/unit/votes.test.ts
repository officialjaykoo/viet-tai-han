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
  it("gives upvotes more weight than downvotes at the same karma", () => {
    expect(voteWeight("upvote", 100)).toBeGreaterThan(
      voteWeight("downvote", 100)
    );
  });

  it("nearly mutes brand-new accounts", () => {
    expect(voteWeight("upvote", 0)).toBeLessThanOrEqual(10);
    expect(voteWeight("upvote", 0)).toBeLessThan(voteWeight("upvote", 500) / 5);
  });

  it("increases influence with voter karma", () => {
    expect(voteWeight("upvote", 1000)).toBeGreaterThan(
      voteWeight("upvote", 0)
    );
  });

  it("never uses negative karma to boost weight", () => {
    expect(voteWeight("upvote", -50)).toBe(voteWeight("upvote", 0));
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
      recentLowKarmaShare: 0.8,
    });
    const down = velocityFactor({
      action: "downvote",
      recentSameDirection: 20,
      recentLowKarmaShare: 0.8,
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

  it("reduces effective weight for inorganic upvote spikes", () => {
    const organic = effectiveVoteWeight({
      action: "upvote",
      voterKarma: 200,
      discoverySource: "home",
      hasPriorView: true,
      recentSameDirection: 0,
      recentLowKarmaShare: 0,
      accountAgeHours: 400,
      votesOnOtherTargets: 50,
    });
    const inorganic = effectiveVoteWeight({
      action: "upvote",
      voterKarma: 5,
      discoverySource: "direct",
      hasPriorView: false,
      recentSameDirection: 25,
      recentLowKarmaShare: 0.9,
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
