export async function retryOnceAfterTransportError<T>(
  operation: () => Promise<T>
): Promise<{ value: T; retried: boolean }> {
  try {
    return { value: await operation(), retried: false };
  } catch (firstError) {
    try {
      return { value: await operation(), retried: true };
    } catch {
      throw firstError;
    }
  }
}
