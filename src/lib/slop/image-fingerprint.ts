/** Stable key for a tweet media URL (path only, no query tokens). */
export function imageFingerprint(imageUrl: string): string {
  try {
    const u = new URL(imageUrl);
    return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch {
    return imageUrl.slice(0, 240).toLowerCase();
  }
}
