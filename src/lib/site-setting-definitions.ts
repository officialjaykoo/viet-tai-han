export type SiteSettingGroup =
  | "general"
  | "content_moderation"
  | "feed_recommendations"
  | "translation_ai"
  | "social_messaging"
  | "marketplace_businesses"
  | "ads"
  | "performance_operations"
  | "legacy";

export type SiteSettingOption = { value: string; label: string };

export type SiteSettingDefinition = {
  key: string;
  group: Exclude<SiteSettingGroup, "legacy">;
  label: string;
  description: string;
  type: "text" | "number" | "boolean" | "select";
  defaultValue: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  unit?: string;
  options?: SiteSettingOption[];
};

const numberDefaults = {
  min: 0,
  max: 1_000_000,
  step: 1,
} as const;

export const SITE_SETTING_DEFINITIONS: SiteSettingDefinition[] = [
  {
    key: "site_name",
    group: "general",
    label: "Site name",
    description: "The default display name used across the service.",
    type: "text",
    defaultValue: "red",
    maxLength: 120,
  },
  {
    key: "registration_open",
    group: "general",
    label: "Open registration",
    description: "Controls whether new users may register accounts.",
    type: "boolean",
    defaultValue: "true",
    options: [
      { value: "true", label: "Enabled" },
      { value: "false", label: "Disabled" },
    ],
  },
  {
    key: "min_account_age_hours_to_post",
    group: "content_moderation",
    label: "Minimum account age to post",
    description: "Minimum account age required before a user can publish a post.",
    type: "number",
    defaultValue: "0",
    ...numberDefaults,
    unit: "hours",
  },
  {
    key: "min_age_hours_to_media",
    group: "content_moderation",
    label: "Minimum account age for media",
    description: "Minimum account age required before a user can upload media to a post.",
    type: "number",
    defaultValue: "24",
    ...numberDefaults,
    unit: "hours",
  },
  {
    key: "ads_enabled",
    group: "ads",
    label: "Advertising",
    description: "Enables ad selection and delivery for eligible placements and viewers.",
    type: "boolean",
    defaultValue: "0",
    options: [
      { value: "1", label: "Enabled" },
      { value: "0", label: "Disabled" },
    ],
  },
  {
    key: "max_posts_per_hour",
    group: "performance_operations",
    label: "Post limit per hour",
    description: "Maximum number of posts allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "5",
    ...numberDefaults,
    unit: "posts/hour",
  },
  {
    key: "max_posts_burst_per_min",
    group: "performance_operations",
    label: "Post burst limit",
    description: "Maximum number of posts allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "2",
    ...numberDefaults,
    unit: "posts/minute",
  },
  {
    key: "max_comments_per_hour",
    group: "performance_operations",
    label: "Comment limit per hour",
    description: "Maximum number of comments allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "15",
    ...numberDefaults,
    unit: "comments/hour",
  },
  {
    key: "max_comments_burst_per_min",
    group: "performance_operations",
    label: "Comment burst limit",
    description: "Maximum number of comments allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "4",
    ...numberDefaults,
    unit: "comments/minute",
  },
  {
    key: "max_likes_per_hour",
    group: "performance_operations",
    label: "Like limit per hour",
    description: "Maximum number of likes allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "120",
    ...numberDefaults,
    unit: "likes/hour",
  },
  {
    key: "max_likes_burst_per_min",
    group: "performance_operations",
    label: "Like burst limit",
    description: "Maximum number of likes allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "30",
    ...numberDefaults,
    unit: "likes/minute",
  },
  {
    key: "max_dm_requests_per_hour",
    group: "social_messaging",
    label: "Message request limit per hour",
    description: "Maximum number of direct message requests allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "3",
    ...numberDefaults,
    unit: "requests/hour",
  },
  {
    key: "max_dm_requests_burst_per_min",
    group: "social_messaging",
    label: "Message request burst limit",
    description: "Maximum number of direct message requests allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "1",
    ...numberDefaults,
    unit: "requests/minute",
  },
  {
    key: "max_dm_messages_per_hour",
    group: "social_messaging",
    label: "Message limit per hour",
    description: "Maximum number of direct messages allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "30",
    ...numberDefaults,
    unit: "messages/hour",
  },
  {
    key: "max_dm_messages_burst_per_min",
    group: "social_messaging",
    label: "Message burst limit",
    description: "Maximum number of direct messages allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "8",
    ...numberDefaults,
    unit: "messages/minute",
  },
  {
    key: "max_dm_reports_per_hour",
    group: "social_messaging",
    label: "Message report limit per hour",
    description: "Maximum number of direct message reports allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "20",
    ...numberDefaults,
    unit: "reports/hour",
  },
  {
    key: "max_questions_per_hour",
    group: "content_moderation",
    label: "Question limit per hour",
    description: "Maximum number of questions allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "5",
    ...numberDefaults,
    unit: "questions/hour",
  },
  {
    key: "max_questions_burst_per_min",
    group: "content_moderation",
    label: "Question burst limit",
    description: "Maximum number of questions allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "2",
    ...numberDefaults,
    unit: "questions/minute",
  },
  {
    key: "max_answers_per_hour",
    group: "content_moderation",
    label: "Answer limit per hour",
    description: "Maximum number of answers allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "30",
    ...numberDefaults,
    unit: "answers/hour",
  },
  {
    key: "max_answers_burst_per_min",
    group: "content_moderation",
    label: "Answer burst limit",
    description: "Maximum number of answers allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "6",
    ...numberDefaults,
    unit: "answers/minute",
  },
  {
    key: "max_listings_per_hour",
    group: "marketplace_businesses",
    label: "Listing limit per hour",
    description: "Maximum number of marketplace listings allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "10",
    ...numberDefaults,
    unit: "listings/hour",
  },
  {
    key: "max_listings_burst_per_min",
    group: "marketplace_businesses",
    label: "Listing burst limit",
    description: "Maximum number of marketplace listings allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "3",
    ...numberDefaults,
    unit: "listings/minute",
  },
  {
    key: "max_businesses_per_hour",
    group: "marketplace_businesses",
    label: "Business limit per hour",
    description: "Maximum number of business profiles allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "3",
    ...numberDefaults,
    unit: "businesses/hour",
  },
  {
    key: "max_businesses_burst_per_min",
    group: "marketplace_businesses",
    label: "Business burst limit",
    description: "Maximum number of business profiles allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "1",
    ...numberDefaults,
    unit: "businesses/minute",
  },
  {
    key: "max_business_verification_per_hour",
    group: "marketplace_businesses",
    label: "Business verification limit per hour",
    description: "Maximum number of business verification requests allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "3",
    ...numberDefaults,
    unit: "requests/hour",
  },
  {
    key: "max_business_verification_burst_per_min",
    group: "marketplace_businesses",
    label: "Business verification burst limit",
    description: "Maximum number of business verification requests allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "1",
    ...numberDefaults,
    unit: "requests/minute",
  },
  {
    key: "max_booking_requests_per_hour",
    group: "marketplace_businesses",
    label: "Booking request limit per hour",
    description: "Maximum number of booking requests allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "10",
    ...numberDefaults,
    unit: "requests/hour",
  },
  {
    key: "max_booking_requests_burst_per_min",
    group: "marketplace_businesses",
    label: "Booking request burst limit",
    description: "Maximum number of booking requests allowed per user during a one-minute burst window.",
    type: "number",
    defaultValue: "3",
    ...numberDefaults,
    unit: "requests/minute",
  },
  {
    key: "max_api_mutate_per_min",
    group: "performance_operations",
    label: "API mutation limit per minute",
    description: "Maximum authenticated mutation requests allowed per user during a one-minute window.",
    type: "number",
    defaultValue: "30",
    ...numberDefaults,
    unit: "requests/minute",
  },
  {
    key: "max_api_mutate_per_hour",
    group: "performance_operations",
    label: "API mutation limit per hour",
    description: "Maximum authenticated mutation requests allowed per user during a rolling hour.",
    type: "number",
    defaultValue: "120",
    ...numberDefaults,
    unit: "requests/hour",
  },
  {
    key: "max_api_mutate_ip_per_min",
    group: "performance_operations",
    label: "API IP mutation limit per minute",
    description: "Maximum mutation requests allowed from one IP address during a one-minute window.",
    type: "number",
    defaultValue: "40",
    ...numberDefaults,
    unit: "requests/minute",
  },
  {
    key: "max_api_mutate_ip_per_hour",
    group: "performance_operations",
    label: "API IP mutation limit per hour",
    description: "Maximum mutation requests allowed from one IP address during a rolling hour.",
    type: "number",
    defaultValue: "180",
    ...numberDefaults,
    unit: "requests/hour",
  },
];

const DEFINITIONS_BY_KEY: Record<string, SiteSettingDefinition> = Object.fromEntries(
  SITE_SETTING_DEFINITIONS.map((definition) => [definition.key, definition])
);

export function getSiteSettingDefinition(key: string): SiteSettingDefinition | null {
  return DEFINITIONS_BY_KEY[key] ?? null;
}

export function isSensitiveSiteSettingKey(key: string): boolean {
  return /(secret|token|credential|private[_-]?key|password|vapid|cloudflare)/i.test(key);
}

export function validateSiteSettingValue(
  key: string,
  input: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = input.trim();
  if (isSensitiveSiteSettingKey(key)) {
    return { ok: false, error: "Sensitive values must be stored as environment secrets." };
  }

  const definition = getSiteSettingDefinition(key);
  if (!definition) {
    if (!/^[a-z0-9_]{2,80}$/.test(key)) {
      return { ok: false, error: "Invalid setting key." };
    }
    if (value.length > 500) {
      return { ok: false, error: "Setting value is too long." };
    }
    return { ok: true, value };
  }

  if (definition.type === "text") {
    if (definition.maxLength && value.length > definition.maxLength) {
      return { ok: false, error: `${definition.label} must be ${definition.maxLength} characters or fewer.` };
    }
    return { ok: true, value };
  }

  if (definition.type === "boolean") {
    const allowed = definition.options?.map((option) => option.value) ?? ["true", "false"];
    if (!allowed.includes(value)) {
      return { ok: false, error: `${definition.label} has an invalid value.` };
    }
    return { ok: true, value };
  }

  if (definition.type === "select") {
    if (!definition.options?.some((option) => option.value === value)) {
      return { ok: false, error: `${definition.label} has an invalid value.` };
    }
    return { ok: true, value };
  }

  if (!/^-?\d+$/.test(value)) {
    return { ok: false, error: `${definition.label} must be a whole number.` };
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    return { ok: false, error: `${definition.label} is outside the supported range.` };
  }
  if (definition.min !== undefined && number < definition.min) {
    return { ok: false, error: `${definition.label} must be at least ${definition.min}.` };
  }
  if (definition.max !== undefined && number > definition.max) {
    return { ok: false, error: `${definition.label} must be at most ${definition.max}.` };
  }
  return { ok: true, value: String(number) };
}

export const SITE_SETTING_GROUPS: Array<{
  id: Exclude<SiteSettingGroup, "legacy">;
  label: string;
}> = [
  { id: "general", label: "General" },
  { id: "content_moderation", label: "Content / Moderation" },
  { id: "feed_recommendations", label: "Feed / Recommendations" },
  { id: "translation_ai", label: "Translation / AI" },
  { id: "social_messaging", label: "Social / Messaging" },
  { id: "marketplace_businesses", label: "Marketplace / Businesses" },
  { id: "ads", label: "Ads" },
  { id: "performance_operations", label: "Performance / Operations" },
];
