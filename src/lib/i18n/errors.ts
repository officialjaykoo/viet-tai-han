import type { Locale } from "@/lib/i18n/config";

/**
 * Canonical English AuthError / API messages → localized copy.
 * Keep AuthError.message in English (stable key); translate at response / display time.
 */
const ERROR_CATALOG: Record<
  string,
  { en: string; ru: string; vi?: string; ko?: string }
> = {
  KOE004: {
    en: "Kakao Login is not enabled for this app. Enable Kakao Login in Kakao Developers and try again.",
    vi: "Kakao Login chưa được bật cho ứng dụng này. Hãy bật Kakao Login trong Kakao Developers rồi thử lại.",
    ko: "이 앱의 카카오 로그인이 활성화되지 않았습니다. Kakao Developers에서 카카오 로그인을 켠 후 다시 시도하세요.",
    ru: "Вход через Kakao не включён для этого приложения. Включите Kakao Login в Kakao Developers и повторите попытку.",
  },
  "Sign in to continue": {
    en: "Sign in to continue",
    ru: "Войдите, чтобы продолжить",
  },
  "This account can't do that": {
    en: "This account can't do that",
    ru: "Этот аккаунт не может этого сделать",
  },
  "Request failed": {
    en: "Request failed",
    ru: "Не удалось выполнить запрос",
  },
  "Something went wrong": {
    en: "Something went wrong",
    ru: "Что-то пошло не так",
  },
  "This content isn't allowed": {
    en: "This content isn't allowed",
    ru: "Этот контент не допускается",
  },
  "You're doing that too often. Try again later.": {
    en: "You're doing that too often. Try again later.",
    ru: "Слишком часто. Попробуйте позже.",
  },
  "User not found": {
    en: "User not found",
    ru: "Пользователь не найден",
  },
  "Post not found": {
    en: "Post not found",
    ru: "Пост не найден",
  },
  "Comment not found": {
    en: "Comment not found",
    ru: "Комментарий не найден",
  },
  "Community not found": {
    en: "Community not found",
    ru: "Сообщество не найдено",
  },
  "Subreddit not found": {
    en: "Subreddit not found",
    ru: "Сообщество не найдено",
  },
  "Chat not found": {
    en: "Chat not found",
    ru: "Чат не найден",
  },
  "Request not found": {
    en: "Request not found",
    ru: "Запрос не найден",
  },
  "Campaign not found": {
    en: "Campaign not found",
    ru: "Кампания не найдена",
  },
  "Not found": {
    en: "Not found",
    ru: "Не найдено",
  },
  "You can't message this user": {
    en: "You can't message this user",
    ru: "Вы не можете написать этому пользователю",
  },
  "You can't message yourself": {
    en: "You can't message yourself",
    ru: "Нельзя написать самому себе",
  },
  "This user isn't accepting chat requests": {
    en: "This user isn't accepting chat requests",
    ru: "Этот пользователь не принимает запросы на переписку",
  },
  "Message must be 1–2000 characters": {
    en: "Message must be 1–2000 characters",
    ru: "Сообщение должно быть от 1 до 2000 символов",
  },
  "Message must be 1–4000 characters": {
    en: "Message must be 1–4000 characters",
    ru: "Сообщение должно быть от 1 до 4000 символов",
  },
  "Chat already exists": {
    en: "Chat already exists",
    ru: "Чат уже существует",
  },
  "A chat request is already pending": {
    en: "A chat request is already pending",
    ru: "Запрос на переписку уже ожидает ответа",
  },
  "Request already handled": {
    en: "Request already handled",
    ru: "Запрос уже обработан",
  },
  "Chat isn't open yet": {
    en: "Chat isn't open yet",
    ru: "Чат ещё не открыт",
  },
  "Display name is required": {
    en: "Display name is required",
    ru: "Укажите отображаемое имя",
  },
  "Invalid theme": {
    en: "Invalid theme",
    ru: "Некорректная тема",
  },
  "Invalid language": {
    en: "Invalid language",
    ru: "Некорректный язык",
  },
  "Invalid DM preference": {
    en: "Invalid DM preference",
    ru: "Некорректная настройка сообщений",
  },
  "Invalid email": {
    en: "Invalid email",
    ru: "Некорректный email",
  },
  "Email already in use": {
    en: "Email already in use",
    ru: "Этот email уже используется",
  },
  "You can't block yourself": {
    en: "You can't block yourself",
    ru: "Нельзя заблокировать самого себя",
  },
  "You can't follow yourself": {
    en: "You can't follow yourself",
    ru: "Нельзя подписаться на самого себя",
  },
  "Can't follow this user": {
    en: "Can't follow this user",
    ru: "Нельзя подписаться на этого пользователя",
  },
  "Invalid report reason": {
    en: "Invalid report reason",
    ru: "Некорректная причина жалобы",
  },
  "You can't report your own post": {
    en: "You can't report your own post",
    ru: "Нельзя пожаловаться на свой пост",
  },
  "You can't report yourself": {
    en: "You can't report yourself",
    ru: "Нельзя пожаловаться на себя",
  },
  "You can't report your own comment": {
    en: "You can't report your own comment",
    ru: "Нельзя пожаловаться на свой комментарий",
  },
  "You already reported this": {
    en: "You already reported this",
    ru: "Вы уже пожаловались на это",
  },
  "Warning message required": {
    en: "Warning message required",
    ru: "Нужен текст предупреждения",
  },
  "Word too short": {
    en: "Word too short",
    ru: "Слово слишком короткое",
  },
  "Invalid severity": {
    en: "Invalid severity",
    ru: "Некорректный уровень",
  },
  "Word already banned": {
    en: "Word already banned",
    ru: "Слово уже в списке запрещённых",
  },
  "Title must be 3–300 characters": {
    en: "Title must be 3–300 characters",
    ru: "Заголовок должен быть от 3 до 300 символов",
  },
  "Title must be 3–100 characters": {
    en: "Title must be 3–100 characters",
    ru: "Заголовок должен быть от 3 до 100 символов",
  },
  "Choose either a link or an image, not both": {
    en: "Choose either a link or an image, not both",
    ru: "Выберите либо ссылку, либо изображение",
  },
  "Invalid URL": {
    en: "Invalid URL",
    ru: "Некорректная ссылка",
  },
  "Invalid media": {
    en: "Invalid media",
    ru: "Некорректный файл",
  },
  "Comment must be 1–10000 characters": {
    en: "Comment must be 1–10000 characters",
    ru: "Комментарий должен быть от 1 до 10000 символов",
  },
  "Post is locked": {
    en: "Post is locked",
    ru: "Пост закрыт для комментариев",
  },
  "Parent comment not found": {
    en: "Parent comment not found",
    ru: "Родительский комментарий не найден",
  },
  "Comment nesting too deep": {
    en: "Comment nesting too deep",
    ru: "Слишком глубокая вложенность комментариев",
  },
  "Only the author can edit this post": {
    en: "Only the author can edit this post",
    ru: "Редактировать пост может только автор",
  },
  "Only the author can edit this comment": {
    en: "Only the author can edit this comment",
    ru: "Редактировать комментарий может только автор",
  },
  "Only the author can view analytics": {
    en: "Only the author can view analytics",
    ru: "Статистику может смотреть только автор",
  },
  "Community name must be at least 3 characters": {
    en: "Community name must be at least 3 characters",
    ru: "Имя сообщества должно быть не короче 3 символов",
  },
  "Community name already taken": {
    en: "Community name already taken",
    ru: "Это имя сообщества уже занято",
  },
  "Name required": {
    en: "Name required",
    ru: "Нужно указать название",
  },
  "Invalid target URL": {
    en: "Invalid target URL",
    ru: "Некорректная целевая ссылка",
  },
  "You don't have permission to do that": {
    en: "You don't have permission to do that",
    ru: "У вас нет прав для этого действия",
  },
  "Your karma is too low to create posts. Contribute positively first.": {
    en: "Your karma is too low to create posts. Contribute positively first.",
    ru: "Недостаточно кармы для постов. Сначала участвуйте конструктивно.",
  },
  "Your karma is too low to send messages. Participate more first.": {
    en: "Your karma is too low to send messages. Participate more first.",
    ru: "Недостаточно кармы для сообщений. Сначала поучаствуйте в обсуждениях.",
  },
  "Your karma is too low to create a community.": {
    en: "Your karma is too low to create a community.",
    ru: "Недостаточно кармы, чтобы создать сообщество.",
  },
  "Invalid username for profile posts": {
    en: "Invalid username for profile posts",
    ru: "Некорректное имя пользователя для постов профиля",
  },
  "Image must be under 1 MB": {
    en: "Image must be under 1 MB",
    ru: "Изображение должно быть меньше 1 МБ",
  },
  "Image must be under 1 MB after processing": {
    en: "Image must be under 1 MB after processing",
    ru: "После обработки изображение всё ещё больше 1 МБ",
  },
  "Image must be under 1 MB after compression": {
    en: "Image must be under 1 MB after compression",
    ru: "После сжатия изображение всё ещё больше 1 МБ",
  },
  "Only JPEG, PNG, or WebP images are allowed": {
    en: "Only JPEG, PNG, or WebP images are allowed",
    ru: "Допускаются только JPEG, PNG или WebP",
  },
  "Image failed security check": {
    en: "Image failed security check",
    ru: "Изображение не прошло проверку безопасности",
  },
  "Image contains trailing dangerous data": {
    en: "Image contains trailing dangerous data",
    ru: "В изображении обнаружены подозрительные данные",
  },
  "Corrupt JPEG image": {
    en: "Corrupt JPEG image",
    ru: "Повреждённый JPEG",
  },
  "Corrupt PNG image": {
    en: "Corrupt PNG image",
    ru: "Повреждённый PNG",
  },
  "Corrupt WebP image": {
    en: "Corrupt WebP image",
    ru: "Повреждённый WebP",
  },
  "Invalid image": {
    en: "Invalid image",
    ru: "Некорректное изображение",
  },
  "Nothing to mark read": {
    en: "Nothing to mark read",
    ru: "Нечего отмечать прочитанным",
  },
  "Failed to load": {
    en: "Failed to load",
    ru: "Не удалось загрузить",
  },
  "Failed to save": {
    en: "Failed to save",
    ru: "Не удалось сохранить",
  },
  Failed: {
    en: "Failed",
    ru: "Ошибка",
  },
  "Upload failed": {
    en: "Upload failed",
    ru: "Не удалось загрузить файл",
  },
  "file is required": {
    en: "file is required",
    ru: "Нужен файл",
  },
  "section is required": {
    en: "section is required",
    ru: "Укажите раздел",
  },
  "email is required": {
    en: "email is required",
    ru: "Укажите email",
  },
  "Unknown section": {
    en: "Unknown section",
    ru: "Неизвестный раздел",
  },
  "Unknown action": {
    en: "Unknown action",
    ru: "Неизвестное действие",
  },
  "Unknown op": {
    en: "Unknown op",
    ru: "Неизвестная операция",
  },
  "Missing fields": {
    en: "Missing fields",
    ru: "Не заполнены обязательные поля",
  },
  "Missing userId": {
    en: "Missing userId",
    ru: "Не указан пользователь",
  },
  "Missing subredditId": {
    en: "Missing subredditId",
    ru: "Не указано сообщество",
  },
  "Missing wordId": {
    en: "Missing wordId",
    ru: "Не указано слово",
  },
  "Missing campaignId": {
    en: "Missing campaignId",
    ru: "Не указана кампания",
  },
  "Admin action failed": {
    en: "Admin action failed",
    ru: "Не удалось выполнить действие администратора",
  },
  "Failed to load admin overview": {
    en: "Failed to load admin overview",
    ru: "Не удалось загрузить панель администратора",
  },
  "Invalid placement": {
    en: "Invalid placement",
    ru: "Некорректное размещение",
  },
  "Failed to load ad": {
    en: "Failed to load ad",
    ru: "Не удалось загрузить рекламу",
  },
  "preferredLanguage must be one of vi, ko, en, or ru": {
    en: "preferredLanguage must be one of vi, ko, en, or ru",
    ru: "Язык должен быть одним из: vi, ko, en или ru",
    vi: "preferredLanguage phải là một trong vi, ko, en hoặc ru",
    ko: "언어는 vi, ko, en 또는 ru 중 하나여야 합니다",
  },
  "Could not update language": {
    en: "Could not update language",
    ru: "Не удалось обновить язык",
  },
  "Could not update NSFW setting": {
    en: "Could not update NSFW setting",
    ru: "Не удалось обновить настройку NSFW",
  },
  "isNsfw boolean is required": {
    en: "isNsfw boolean is required",
    ru: "Нужно указать значение NSFW",
  },
  "Could not save profile": {
    en: "Could not save profile",
    ru: "Не удалось сохранить профиль",
  },
  "Could not update email": {
    en: "Could not update email",
    ru: "Не удалось обновить email",
  },
  "Could not change password": {
    en: "Could not change password",
    ru: "Не удалось сменить пароль",
  },
  "Could not save": {
    en: "Could not save",
    ru: "Не удалось сохранить",
  },
  "Password must be at least 8 characters": {
    en: "Password must be at least 8 characters",
    ru: "Пароль должен быть не короче 8 символов",
  },
  "Passwords do not match": {
    en: "Passwords do not match",
    ru: "Пароли не совпадают",
  },
  "Profile saved": {
    en: "Profile saved",
    ru: "Профиль сохранён",
  },
  "Email updated": {
    en: "Email updated",
    ru: "Email обновлён",
  },
  "Password changed": {
    en: "Password changed",
    ru: "Пароль изменён",
  },
  Saved: {
    en: "Saved",
    ru: "Сохранено",
  },
  "Vote failed": {
    en: "Vote failed",
    ru: "Не удалось проголосовать",
  },
  "Couldn't apply vote. Try again.": {
    en: "Couldn't apply vote. Try again.",
    ru: "Не удалось учесть голос. Попробуйте снова.",
  },
  "Could not post comment": {
    en: "Could not post comment",
    ru: "Не удалось отправить комментарий",
  },
  "Couldn't update membership": {
    en: "Couldn't update membership",
    ru: "Не удалось обновить подписку",
  },
  "Couldn't load analytics": {
    en: "Couldn't load analytics",
    ru: "Не удалось загрузить аналитику",
  },
  "Couldn't load more posts.": {
    en: "Couldn't load more posts.",
    ru: "Не удалось загрузить ещё посты.",
  },
  "Failed to load more posts": {
    en: "Failed to load more posts",
    ru: "Не удалось загрузить ещё посты",
  },
  "Edit failed": {
    en: "Edit failed",
    ru: "Не удалось изменить",
  },
  "Delete failed": {
    en: "Delete failed",
    ru: "Не удалось удалить",
  },
  "Delete this post?": {
    en: "Delete this post?",
    ru: "Удалить этот пост?",
  },
  "Action failed": {
    en: "Action failed",
    ru: "Действие не выполнено",
  },
  "Backfill failed": {
    en: "Backfill failed",
    ru: "Ошибка заполнения",
  },
  "Could not generate avatar": {
    en: "Could not generate avatar",
    ru: "Не удалось создать аватар",
  },
  "Invalid credentials": {
    en: "Invalid credentials",
    ru: "Неверный логин или пароль",
  },
  "User already exists": {
    en: "User already exists",
    ru: "Пользователь уже существует",
  },
  "Username is already taken": {
    en: "Username is already taken",
    ru: "Это имя пользователя уже занято",
  },
  "Password is too short": {
    en: "Password is too short",
    ru: "Пароль слишком короткий",
  },
  "Couldn't load messages": {
    en: "Couldn't load messages",
    ru: "Не удалось загрузить сообщения",
  },
  "Couldn't load chat": {
    en: "Couldn't load chat",
    ru: "Не удалось загрузить чат",
  },
  "Couldn't send request": {
    en: "Couldn't send request",
    ru: "Не удалось отправить запрос",
  },
  "Couldn't update request": {
    en: "Couldn't update request",
    ru: "Не удалось обновить запрос",
  },
  "Couldn't send": {
    en: "Couldn't send",
    ru: "Не удалось отправить",
  },
  "Failed to load chat": {
    en: "Failed to load chat",
    ru: "Не удалось загрузить чат",
  },
  "Failed to send message": {
    en: "Failed to send message",
    ru: "Не удалось отправить сообщение",
  },
  "Failed to update request": {
    en: "Failed to update request",
    ru: "Не удалось обновить запрос",
  },
  "Failed to load messages": {
    en: "Failed to load messages",
    ru: "Не удалось загрузить сообщения",
  },
  "Failed to start chat": {
    en: "Failed to start chat",
    ru: "Не удалось начать чат",
  },
  "Failed to load feed": {
    en: "Failed to load feed",
    ru: "Не удалось загрузить ленту",
  },
  "Failed to create post": {
    en: "Failed to create post",
    ru: "Не удалось создать пост",
  },
  "Failed to edit post": {
    en: "Failed to edit post",
    ru: "Не удалось изменить пост",
  },
  "Failed to delete post": {
    en: "Failed to delete post",
    ru: "Не удалось удалить пост",
  },
  "Failed to edit comment": {
    en: "Failed to edit comment",
    ru: "Не удалось изменить комментарий",
  },
  "Failed to delete comment": {
    en: "Failed to delete comment",
    ru: "Не удалось удалить комментарий",
  },
  "Failed to load community": {
    en: "Failed to load community",
    ru: "Не удалось загрузить сообщество",
  },
  "Failed to join community": {
    en: "Failed to join community",
    ru: "Не удалось вступить в сообщество",
  },
  "Failed to leave community": {
    en: "Failed to leave community",
    ru: "Не удалось выйти из сообщества",
  },
  "Could not submit report": {
    en: "Could not submit report",
    ru: "Не удалось отправить жалобу",
  },
  "Could not unhide post": {
    en: "Could not unhide post",
    ru: "Не удалось показать пост",
  },
  "subreddit and title are required": {
    en: "subreddit and title are required",
    ru: "Укажите сообщество и заголовок",
  },
  "Set a username before posting to your profile": {
    en: "Set a username before posting to your profile",
    ru: "Укажите имя пользователя перед публикацией в профиле",
  },
  "toUsername and body are required": {
    en: "toUsername and body are required",
    ru: "Укажите получателя и текст сообщения",
  },
  "action must be accept or decline": {
    en: "action must be accept or decline",
    ru: "Действие должно быть accept или decline",
  },
  "body is required": {
    en: "body is required",
    ru: "Нужен текст",
  },
  "Invalid limit": {
    en: "Invalid limit",
    ru: "Некорректный лимит",
  },
  "Invalid cursor": {
    en: "Invalid cursor",
    ru: "Некорректный курсор",
  },
  "Invalid sort": {
    en: "Invalid sort",
    ru: "Некорректная сортировка",
  },
  "Invalid feed mode": {
    en: "Invalid feed mode",
    ru: "Некорректный режим ленты",
  },
  "Missing post id": {
    en: "Missing post id",
    ru: "Не указан пост",
  },
  "Could not hide post": {
    en: "Could not hide post",
    ru: "Не удалось скрыть пост",
  },
  "Failed to load post": {
    en: "Failed to load post",
    ru: "Не удалось загрузить пост",
  },
  "reason is required": {
    en: "reason is required",
    ru: "Укажите причину",
  },
  "Search failed": {
    en: "Search failed",
    ru: "Поиск не удался",
  },
  "Failed to apply vote": {
    en: "Failed to apply vote",
    ru: "Не удалось учесть голос",
  },
  "Failed to create comment": {
    en: "Failed to create comment",
    ru: "Не удалось создать комментарий",
  },
  "Failed to create community": {
    en: "Failed to create community",
    ru: "Не удалось создать сообщество",
  },
  "Failed to list communities": {
    en: "Failed to list communities",
    ru: "Не удалось загрузить сообщества",
  },
  "Failed to load recommendations": {
    en: "Failed to load recommendations",
    ru: "Не удалось загрузить рекомендации",
  },
  "Failed to vote on comment": {
    en: "Failed to vote on comment",
    ru: "Не удалось проголосовать за комментарий",
  },
  "action must be 'upvote' or 'downvote'": {
    en: "action must be 'upvote' or 'downvote'",
    ru: "Действие должно быть upvote или downvote",
  },
  "name and title are required": {
    en: "name and title are required",
    ru: "Укажите имя и название",
  },
};

function genericError(locale: Locale): string {
  switch (locale) {
    case "vi":
      return "Đã xảy ra lỗi";
    case "ko":
      return "문제가 발생했습니다";
    case "ru":
      return "Произошла ошибка";
    default:
      return "Something went wrong";
  }
}

function normalizeKey(message: string): string {
  return message
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .trim();
}

export function localizeErrorMessage(
  message: string,
  locale: Locale,
  fallback?: string
): string {
  const key = normalizeKey(message);
  const entry = ERROR_CATALOG[key];
  if (entry) return entry[locale] ?? genericError(locale);

  // Policy / infra sanitization (mirror public-error rules)
  if (/banned words/i.test(key)) {
    return genericError(locale);
  }
  if (/shadow/i.test(key)) {
    return genericError(locale);
  }
  if (/rate limit/i.test(key)) {
    return genericError(locale);
  }
  if (
    /sql|d1|sqlite|vectorize|workers ai|durable object|r2|wrangler/i.test(key)
  ) {
    return genericError(locale);
  }

  return genericError(locale);
}
