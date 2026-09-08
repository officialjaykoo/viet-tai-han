import { describe, expect, it } from "vitest";

import {
  parseCreatePostPayload,
  parseEditPostPayload,
} from "@/lib/post-payload";

function expectInvalidPayload(run: () => unknown) {
  expect(run).toThrow(/Invalid post payload/);
}

describe("post payload parsing", () => {
  it("rejects non-string create fields before action code runs", () => {
    expectInvalidPayload(() =>
      parseCreatePostPayload({ subreddit: "general", title: {} })
    );
    expectInvalidPayload(() =>
      parseCreatePostPayload({ subreddit: "general", title: "Title", body: 42 })
    );
    expectInvalidPayload(() =>
      parseCreatePostPayload({ subreddit: "general", title: "Title", url: [] })
    );
  });

  it("accepts nullable optional create fields", () => {
    expect(
      parseCreatePostPayload({
        subreddit: "general",
        title: "Title",
        body: null,
        url: null,
        mediaKey: null,
        requestId: null,
      })
    ).toMatchObject({ subreddit: "general", title: "Title" });
  });

  it("rejects malformed edit field types", () => {
    expectInvalidPayload(() => parseEditPostPayload({ title: {} }));
    expectInvalidPayload(() => parseEditPostPayload({ body: false }));
    expectInvalidPayload(() => parseEditPostPayload({ url: 123 }));
  });
});
