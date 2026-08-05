/**
 * Easter egg: mention the word "laefye" in a post or comment
 * to unlock the laefye achievement (nod to a friend).
 */

export const LAEFYE_SLUG = "laefye";

/** Whole-word, case-insensitive match for "laefye". */
const LAEFYE_WORD = /\blaefye\b/iu;

export function mentionsLaefye(
  ...parts: Array<string | null | undefined>
): boolean {
  return parts.some((part) => Boolean(part && LAEFYE_WORD.test(part)));
}
