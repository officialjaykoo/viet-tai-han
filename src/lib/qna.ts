import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";

export type QuestionAuthor = {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  isAuthor: boolean;
};

export type QuestionCommunity = {
  id: string;
  name: string;
  title: string;
};

export type QuestionSummary = {
  id: string;
  title: string;
  body: string;
  answerCount: number;
  acceptedAnswerId: string | null;
  createdAt: string;
  author: QuestionAuthor;
  community: QuestionCommunity;
};

export type QuestionAnswer = {
  id: string;
  questionId: string;
  body: string;
  isAccepted: boolean;
  createdAt: string;
  author: QuestionAuthor;
};

export type QuestionDetail = QuestionSummary & {
  isLocked: boolean;
  answers: QuestionAnswer[];
};

type QuestionRow = {
  id: string;
  title: string;
  body: string;
  answer_count: number;
  accepted_answer_id: string | null;
  is_locked: number;
  created_at: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  author_image: string | null;
  subreddit_id: string;
  subreddit_name: string;
  subreddit_title: string;
};

type AnswerRow = {
  id: string;
  question_id: string;
  body: string;
  is_accepted: number;
  created_at: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  author_image: string | null;
};

function mapAuthor(
  row: Pick<
    QuestionRow,
    | "author_id"
    | "author_username"
    | "author_display_name"
    | "author_image"
  >,
  viewerUserId?: string | null
): QuestionAuthor {
  return {
    id: row.author_id,
    username: row.author_username,
    displayName: row.author_display_name,
    image: row.author_image,
    isAuthor: Boolean(viewerUserId && viewerUserId === row.author_id),
  };
}

function mapSummary(
  row: QuestionRow,
  viewerUserId?: string | null
): QuestionSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    answerCount: Number(row.answer_count ?? 0),
    acceptedAnswerId: row.accepted_answer_id,
    createdAt: row.created_at,
    author: mapAuthor(row, viewerUserId),
    community: {
      id: row.subreddit_id,
      name: row.subreddit_name,
      title: row.subreddit_title,
    },
  };
}

function mapAnswer(
  row: AnswerRow,
  viewerUserId?: string | null
): QuestionAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    body: row.body,
    isAccepted: Boolean(row.is_accepted),
    createdAt: row.created_at,
    author: mapAuthor(row, viewerUserId),
  };
}

function clampLimit(limit: number | undefined, fallback = 30) {
  return Math.min(Math.max(limit ?? fallback, 1), 100);
}

export async function listQuestions(options: {
  limit?: number;
  subredditName?: string | null;
  viewerUserId?: string | null;
} = {}): Promise<QuestionSummary[]> {
  const db = await getDb();
  const where = [
    "q.is_removed = 0",
    "q.is_shadow_hidden = 0",
    "s.is_removed = 0",
  ];
  const params: Array<string | number> = [];

  if (options.subredditName) {
    where.push("s.name = ? COLLATE NOCASE");
    params.push(options.subredditName);
  }

  const { results } = await db
    .prepare(
      `SELECT
         q.id, q.title, q.body, q.answer_count, q.accepted_answer_id,
         q.is_locked, q.created_at,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
         s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title
       FROM questions q
       INNER JOIN "user" u ON u.id = q.author_id
       INNER JOIN subreddits s ON s.id = q.subreddit_id
       WHERE ${where.join(" AND ")}
       ORDER BY q.created_at DESC, q.id DESC
       LIMIT ?`
    )
    .bind(...params, clampLimit(options.limit))
    .all<QuestionRow>();

  return (results ?? []).map((row) => mapSummary(row, options.viewerUserId));
}

export async function getQuestionDetail(
  questionId: string,
  viewerUserId?: string | null
): Promise<QuestionDetail | null> {
  const db = await getDb();
  const question = await db
    .prepare(
      `SELECT
         q.id, q.title, q.body, q.answer_count, q.accepted_answer_id,
         q.is_locked, q.created_at,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
         s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title
       FROM questions q
       INNER JOIN "user" u ON u.id = q.author_id
       INNER JOIN subreddits s ON s.id = q.subreddit_id
       WHERE q.id = ?
         AND q.is_removed = 0
         AND q.is_shadow_hidden = 0
         AND s.is_removed = 0`
    )
    .bind(questionId)
    .first<QuestionRow>();

  if (!question) return null;

  const { results } = await db
    .prepare(
      `SELECT
         a.id, a.question_id, a.body, a.is_accepted, a.created_at,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image
       FROM answers a
       INNER JOIN "user" u ON u.id = a.author_id
       WHERE a.question_id = ?
         AND a.is_removed = 0
         AND a.is_shadow_hidden = 0
       ORDER BY a.is_accepted DESC, a.created_at ASC, a.id ASC`
    )
    .bind(questionId)
    .all<AnswerRow>();

  return {
    ...mapSummary(question, viewerUserId),
    isLocked: Boolean(question.is_locked),
    answers: (results ?? []).map((row) => mapAnswer(row, viewerUserId)),
  };
}

export async function createQuestion(input: {
  userId: string;
  userStatus?: string | null;
  subredditName: string;
  title: string;
  body: string;
}) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 300) {
    throw new AuthError("Title must be 3–300 characters", 400);
  }
  if (body.length < 10 || body.length > 10_000) {
    throw new AuthError("Question must be 10–10000 characters", 400);
  }

  await enforceCreateRateLimit(input.userId, "question");

  const moderation = await moderateText(`${title}\n${body}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const db = await getDb();
  const community = await db
    .prepare(
      `SELECT id FROM subreddits
       WHERE name = ? COLLATE NOCASE AND is_removed = 0`
    )
    .bind(input.subredditName.trim())
    .first<{ id: string }>();
  if (!community) throw new AuthError("Community not found", 404);

  const id = createPublicId();
  const shadow = moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO questions (
         id, subreddit_id, author_id, title, body, is_shadow_hidden
       ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, community.id, input.userId, title, body, shadow)
    .run();

  return { id };
}

export async function createAnswer(input: {
  userId: string;
  userStatus?: string | null;
  questionId: string;
  body: string;
}) {
  const body = input.body.trim();
  if (body.length < 2 || body.length > 10_000) {
    throw new AuthError("Answer must be 2–10000 characters", 400);
  }

  await enforceCreateRateLimit(input.userId, "answer");

  const db = await getDb();
  const question = await db
    .prepare(
      `SELECT id, is_locked, is_removed, is_shadow_hidden
       FROM questions WHERE id = ?`
    )
    .bind(input.questionId)
    .first<{
      id: string;
      is_locked: number;
      is_removed: number;
      is_shadow_hidden: number;
    }>();

  if (!question || question.is_removed || question.is_shadow_hidden) {
    throw new AuthError("Question not found", 404);
  }
  if (question.is_locked) throw new AuthError("Question is locked", 403);

  const moderation = await moderateText(body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const id = createPublicId();
  const shadow = moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  await db.batch([
    db
      .prepare(
        `INSERT INTO answers (
           id, question_id, author_id, body, is_shadow_hidden
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, input.questionId, input.userId, body, shadow),
    ...(shadow
      ? []
      : [
          db
            .prepare(
              `UPDATE questions
               SET answer_count = answer_count + 1, updated_at = datetime('now')
               WHERE id = ?`
            )
            .bind(input.questionId),
        ]),
  ]);

  return { id };
}

export async function toggleAcceptedAnswer(input: {
  userId: string;
  questionId: string;
  answerId: string;
}) {
  const db = await getDb();
  const question = await db
    .prepare(
      `SELECT id, author_id, accepted_answer_id, is_removed, is_shadow_hidden
       FROM questions WHERE id = ?`
    )
    .bind(input.questionId)
    .first<{
      id: string;
      author_id: string;
      accepted_answer_id: string | null;
      is_removed: number;
      is_shadow_hidden: number;
    }>();

  if (!question || question.is_removed || question.is_shadow_hidden) {
    throw new AuthError("Question not found", 404);
  }
  if (question.author_id !== input.userId) {
    throw new AuthError("Only the question author can accept an answer", 403);
  }

  const answer = await db
    .prepare(
      `SELECT id FROM answers
       WHERE id = ? AND question_id = ?
         AND is_removed = 0 AND is_shadow_hidden = 0`
    )
    .bind(input.answerId, input.questionId)
    .first<{ id: string }>();
  if (!answer) throw new AuthError("Answer not found", 404);

  const nextAcceptedId =
    question.accepted_answer_id === input.answerId ? null : input.answerId;
  const statements = [
    db
      .prepare(`UPDATE answers SET is_accepted = 0 WHERE question_id = ?`)
      .bind(input.questionId),
  ];
  if (nextAcceptedId) {
    statements.push(
      db
        .prepare(
          `UPDATE answers SET is_accepted = 1
           WHERE id = ? AND question_id = ?`
        )
        .bind(nextAcceptedId, input.questionId)
    );
  }
  statements.push(
    db
      .prepare(
        `UPDATE questions
         SET accepted_answer_id = ?, updated_at = datetime('now')
         WHERE id = ? AND author_id = ?`
      )
      .bind(nextAcceptedId, input.questionId, input.userId)
  );
  await db.batch(statements);

  return { acceptedAnswerId: nextAcceptedId };
}
export function serializeQuestionSummary(question: QuestionSummary) {
  return {
    id: question.id,
    title: question.title,
    body: question.body,
    answerCount: question.answerCount,
    acceptedAnswerId: question.acceptedAnswerId,
    createdAt: question.createdAt,
    author: {
      username: question.author.username,
      displayName: question.author.displayName,
      image: question.author.image,
      isAuthor: question.author.isAuthor,
    },
    community: question.community,
  };
}

export function serializeQuestionDetail(question: QuestionDetail) {
  return {
    ...serializeQuestionSummary(question),
    isLocked: question.isLocked,
    answers: question.answers.map((answer) => ({
      id: answer.id,
      questionId: answer.questionId,
      body: answer.body,
      isAccepted: answer.isAccepted,
      createdAt: answer.createdAt,
      author: {
        username: answer.author.username,
        displayName: answer.author.displayName,
        image: answer.author.image,
        isAuthor: answer.author.isAuthor,
      },
    })),
  };
}
