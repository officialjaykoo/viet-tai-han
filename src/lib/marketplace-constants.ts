export const LISTING_KINDS = ["market", "job", "service"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_STATUSES = ["active", "sold", "closed", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_REPORT_REASONS = [
  "scam",
  "prohibited",
  "misleading",
  "unsafe",
  "other",
] as const;
export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number];
