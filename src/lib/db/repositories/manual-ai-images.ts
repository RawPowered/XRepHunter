import { dbQuery, dbRun } from '../bridge';
import { imageFingerprint } from '../../slop/image-fingerprint';

export const DEFAULT_MANUAL_AI_SLOP_SCORE = 82;

export async function markImageAsAi(
  handle: string,
  imageUrl: string,
  slopScore = DEFAULT_MANUAL_AI_SLOP_SCORE,
): Promise<void> {
  const h = handle.toLowerCase();
  const fp = imageFingerprint(imageUrl);
  await dbRun(
    `INSERT INTO manual_ai_images (handle, image_fingerprint, slop_score, marked_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(handle, image_fingerprint) DO UPDATE SET
       slop_score = excluded.slop_score,
       marked_at = excluded.marked_at`,
    [h, fp, slopScore, Date.now()],
  );
}

export async function unmarkImageAsAi(handle: string, imageUrl: string): Promise<void> {
  const h = handle.toLowerCase();
  const fp = imageFingerprint(imageUrl);
  await dbRun('DELETE FROM manual_ai_images WHERE handle = ? AND image_fingerprint = ?', [
    h,
    fp,
  ]);
}

export async function isImageMarkedAsAi(handle: string, imageUrl: string): Promise<boolean> {
  const h = handle.toLowerCase();
  const fp = imageFingerprint(imageUrl);
  const { rows } = await dbQuery(
    'SELECT 1 FROM manual_ai_images WHERE handle = ? AND image_fingerprint = ? LIMIT 1',
    [h, fp],
  );
  return rows.length > 0;
}

export async function getMaxManualAiSlopForHandle(handle: string): Promise<number> {
  const { rows } = await dbQuery(
    'SELECT MAX(slop_score) AS m FROM manual_ai_images WHERE handle = ?',
    [handle.toLowerCase()],
  );
  if (!rows.length || rows[0].m == null) return 0;
  return Number(rows[0].m) || 0;
}

export async function listMarkedImageFingerprints(handle: string): Promise<string[]> {
  const { rows } = await dbQuery(
    'SELECT image_fingerprint FROM manual_ai_images WHERE handle = ?',
    [handle.toLowerCase()],
  );
  return rows.map((r) => String(r.image_fingerprint));
}

export async function getManualSlopForImage(
  handle: string,
  imageUrl: string,
): Promise<number | null> {
  const h = handle.toLowerCase();
  const fp = imageFingerprint(imageUrl);
  const { rows } = await dbQuery(
    'SELECT slop_score FROM manual_ai_images WHERE handle = ? AND image_fingerprint = ? LIMIT 1',
    [h, fp],
  );
  if (!rows.length || rows[0].slop_score == null) return null;
  return Number(rows[0].slop_score);
}
