import { env } from "cloudflare:test";
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
  it("filters questions from canonical answer fields", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const unansweredId = `question_unanswered_${crypto.randomUUID()}`;
    const answeredId = `question_answered_${crypto.randomUUID()}`;
    const solvedId = `question_solved_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO questions (id, subreddit_id, author_id, title, body)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        unansweredId,
        subredditId,
        authorId,
        "Unanswered filter question",
        "This question has no answer."
      ),
      env.DB.prepare(
        `INSERT INTO questions (id, subreddit_id, author_id, title, body)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        answeredId,
        subredditId,
        authorId,
        "Answered filter question",
        "This question has a non-accepted answer."
      ),
      env.DB.prepare(
        `INSERT INTO questions (id, subreddit_id, author_id, title, body)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        solvedId,
        subredditId,
        authorId,
        "Solved filter question",
        "This question has an accepted answer."
      ),
    ]);
    const answeredAnswerId = `answer_answered_${crypto.randomUUID()}`;
    const solvedAnswerId = `answer_solved_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO answers (id, question_id, author_id, body)
         VALUES (?, ?, ?, ?)`
      ).bind(answeredAnswerId, answeredId, actorId, "A useful answer."),
      env.DB.prepare(
        `INSERT INTO answers (id, question_id, author_id, body, is_accepted)
         VALUES (?, ?, ?, ?, 1)`
      ).bind(solvedAnswerId, solvedId, actorId, "The accepted answer."),
      env.DB.prepare(
        `UPDATE questions SET answer_count = 1 WHERE id IN (?, ?)`
      ).bind(answeredId, solvedId),
      env.DB.prepare(
        `UPDATE questions SET accepted_answer_id = ? WHERE id = ?`
      ).bind(solvedAnswerId, solvedId),
    ]);
    const unanswered = { id: unansweredId };
    const answered = { id: answeredId };
    const solved = { id: solvedId };

    await expect(
      listQuestions({ filter: "unanswered" })
    ).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unanswered.id }),
    ]));
    await expect(
      listQuestions({ filter: "unanswered" })
    ).resolves.not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: answered.id }),
      expect.objectContaining({ id: solved.id }),
    ]));
    await expect(
      listQuestions({ filter: "answered" })
    ).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: answered.id }),
      expect.objectContaining({ id: solved.id }),
    ]));
    await expect(
      listQuestions({ filter: "solved" })
    ).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: solved.id }),
    ]));
    await expect(
      listQuestions({ filter: "solved" })
    ).resolves.not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unanswered.id }),
      expect.objectContaining({ id: answered.id }),
    ]));
  });
});
