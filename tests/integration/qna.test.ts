import { describe, expect, it } from "vitest";

import {
  createAnswer,
  createQuestion,
  getQuestionDetail,
  listQuestions,
  toggleAcceptedAnswer,
} from "@/lib/qna";
import { AuthError } from "@/lib/session";
import { searchAll } from "@/lib/search";
import { seedUsersAndSubreddit } from "./helpers";

describe("Q&A lifecycle (D1)", () => {
  it("creates questions and answers, then toggles acceptance atomically", async () => {
    const { authorId, voterId, subredditName } = await seedUsersAndSubreddit();

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
      userId: voterId,
      questionId: question.id,
      body: "Bring your identity documents and verify every deposit and fee in writing.",
    });
    expect(answer.id).toBeTruthy();

    await expect(
      toggleAcceptedAnswer({
        userId: voterId,
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
});
