export function postFingerprint(
  handle: string,
  text: string,
  imageUrl?: string,
  statusId?: string,
): string {
  const slice = text.slice(0, 200).replace(/\s+/g, ' ').trim();
  const raw = `${handle.toLowerCase()}|${statusId ?? ''}|${slice}|${imageUrl ?? ''}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
