import { describe, expect, it } from "vitest";

import {
  parseAcceptAnswerPayload,
  parseAnswerPayload,
  parseCommentPayload,
  parseLikePayload,
  parseListingPayload,
  parseQuestionPayload,
} from "@/lib/content-payload";

const malformed = [null, [], "body", 42, {}];

describe("public content payload parsers", () => {
  it.each(malformed)("rejects malformed like payload %#", (value) => {
    expect(() => parseLikePayload(value)).toThrowError(
      expect.objectContaining({ status: 400 })
    );
  });

  it("rejects unknown like actions and wrong field types", () => {
    expect(() => parseLikePayload({ action: "vote" })).toThrowError(
      expect.objectContaining({ status: 400 })
    );
    expect(() => parseCommentPayload({ body: 123 })).toThrowError(
      expect.objectContaining({ status: 400 })
    );
    expect(() => parseQuestionPayload(null)).toThrowError(
      expect.objectContaining({ status: 400 })
    );
    expect(() => parseAnswerPayload({ body: "ok", requestId: 1 })).toThrowError(
      expect.objectContaining({ status: 400 })
    );
    expect(() => parseAcceptAnswerPayload({ answerId: [] })).toThrowError(
      expect.objectContaining({ status: 400 })
    );
  });
  it("rejects invalid listing field types", () => {
    expect(() =>
      parseListingPayload({
        kind: "market",
        category: "Furniture",
        title: "A listing",
        body: "A sufficiently long listing body.",
        location: "Seoul",
        price: 100,
      })
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it("preserves valid optional fields", () => {
    expect(
      parseCommentPayload({
        body: "A valid comment",
        parentId: null,
        requestId: "request-1",
      })
    ).toEqual({
      body: "A valid comment",
      parentId: null,
      requestId: "request-1",
    });
  });
});
