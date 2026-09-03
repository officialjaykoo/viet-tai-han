export const BUSINESS_STATUSES = ["active", "paused", "removed"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BUSINESS_VERIFICATION_STATUSES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type BusinessVerificationStatus =
  (typeof BUSINESS_VERIFICATION_STATUSES)[number];

export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "cancelled",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_OWNER_STATUSES = [
  "confirmed",
  "declined",
  "completed",
] as const;
export type BookingOwnerStatus = (typeof BOOKING_OWNER_STATUSES)[number];
