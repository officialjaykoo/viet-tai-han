import { describe, expect, it } from "vitest";

import {
  createAnswer,
  createQuestion,
  getQuestionDetail,
  listQuestions,
  toggleAcceptedAnswer,
} from "@/lib/qna";
import { AuthError } from "@/lib/session";
import { blockUser } from "@/lib/user-actions";
import { searchAll } from "@/lib/search";
import { seedUsersAndSubreddit } from "./helpers";

describe("Q&A lifecycle (D1)", () => {
  it("creates questions and answers, then toggles acceptance atomically", async () => {
    const { authorId, actorId, subredditName } = await seedUsersAndSubreddit();

    const question = await createQuestion({
      userId: authorId,
      subredditName,
      title: "Where can I get help with a housing contract?",
      body: "I am moving soon and need a checklist for reviewing my first lease.",
    });
    expect(question.id).toBeTruthy();

    const listed = await listQuestions({
      subredditName,
      viewerUserId: authorId,
    });
    expect(listed.some((item) => item.id === question.id)).toBe(true);
    const search = await searchAll("housing contract");
    expect(search.questions.some((item) => item.id === question.id)).toBe(true);

    const answer = await createAnswer({
      userId: actorId,
      questionId: question.id,
      body: "Bring your identity documents and verify every deposit and fee in writing.",
    });
    expect(answer.id).toBeTruthy();

    await expect(
      toggleAcceptedAnswer({
        userId: actorId,
        questionId: question.id,
        answerId: answer.id,
      })
    ).rejects.toBeInstanceOf(AuthError);

    const accepted = await toggleAcceptedAnswer({
      userId: authorId,
      questionId: question.id,
      answerId: answer.id,
    });
    expect(accepted.acceptedAnswerId).toBe(answer.id);

    let detail = await getQuestionDetail(question.id, authorId);
    expect(detail?.answerCount).toBe(1);
    expect(detail?.answers).toHaveLength(1);
    expect(detail?.answers[0]?.isAccepted).toBe(true);
    expect(detail?.acceptedAnswerId).toBe(answer.id);

    const cleared = await toggleAcceptedAnswer({
      userId: authorId,
      questionId: question.id,
      answerId: answer.id,
    });
    expect(cleared.acceptedAnswerId).toBeNull();

    detail = await getQuestionDetail(question.id, authorId);
    expect(detail?.answers[0]?.isAccepted).toBe(false);
    expect(detail?.acceptedAnswerId).toBeNull();
  });
  it("enforces Q&A block policy and conflicting request IDs", async () => {
    const { authorId, actorId, subredditName } = await seedUsersAndSubreddit();
    const questionRequestId = crypto.randomUUID();
    const question = await createQuestion({
      userId: authorId,
      subredditName,
      title: "Retry-safe Q&A question",
      body: "This question verifies request identity and block policy.",
      requestId: questionRequestId,
    });
    await expect(
      createQuestion({
        userId: authorId,
        subredditName,
        title: "Retry-safe Q&A question",
        body: "A conflicting body must return a conflict.",
        requestId: questionRequestId,
      })
    ).rejects.toMatchObject({ status: 409 });

    const answerRequestId = crypto.randomUUID();
    const answer = await createAnswer({
      userId: actorId,
      questionId: question.id,
      body: "This answer is safe to retry.",
      requestId: answerRequestId,
    });
    await expect(
      createAnswer({
        userId: actorId,
        questionId: question.id,
        body: "A conflicting answer body.",
        requestId: answerRequestId,
      })
    ).rejects.toMatchObject({ status: 409 });

    await toggleAcceptedAnswer({
      userId: authorId,
      questionId: question.id,
      answerId: answer.id,
    });
    await blockUser(authorId, actorId);
    await expect(
      createAnswer({
        userId: actorId,
        questionId: question.id,
        body: "New answers are denied after a block.",
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      toggleAcceptedAnswer({
        userId: authorId,
        questionId: question.id,
        answerId: answer.id,
      })
    ).resolves.toEqual({ acceptedAnswerId: null });
  });
});
