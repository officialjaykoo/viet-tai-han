export function getCanonicalPostUrl(postId: string, origin: string): string {
  return new URL(`/post/${encodeURIComponent(postId)}`, origin).toString();
}
