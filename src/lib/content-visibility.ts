/**
 * Canonical public post predicate. Callers must join the community table using
 * the supplied aliases so removed communities cannot leak their posts.
 */
export function publicPostVisibilitySql(
  postAlias = "p",
  communityAlias = "s"
): string {
  return `${postAlias}.is_removed = 0 AND ${postAlias}.is_shadow_hidden = 0 AND ${communityAlias}.is_removed = 0`;
}
