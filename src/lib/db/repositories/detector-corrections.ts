import { dbQuery, dbRun } from '../bridge';
import type { DetectorCorrectionKind } from '../../types';

export async function setDetectorCorrection(
  postFingerprint: string,
  handle: string,
  correction: DetectorCorrectionKind,
): Promise<void> {
  await dbRun(
    `INSERT INTO detector_corrections (post_fingerprint, handle, correction, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(post_fingerprint, correction) DO UPDATE SET
       created_at = excluded.created_at`,
    [postFingerprint, handle.toLowerCase(), correction, Date.now()],
  );
}

export async function removeDetectorCorrection(
  postFingerprint: string,
  correction: DetectorCorrectionKind,
): Promise<void> {
  await dbRun(
    'DELETE FROM detector_corrections WHERE post_fingerprint = ? AND correction = ?',
    [postFingerprint, correction],
  );
}

export async function listDetectorCorrections(
  postFingerprint: string,
): Promise<DetectorCorrectionKind[]> {
  const { rows } = await dbQuery(
    'SELECT correction FROM detector_corrections WHERE post_fingerprint = ?',
    [postFingerprint],
  );
  return rows.map((r) => String(r.correction) as DetectorCorrectionKind);
}

export async function listCorrectionsForHandle(handle: string): Promise<
  Array<{ postFingerprint: string; correction: DetectorCorrectionKind; createdAt: number }>
> {
  const { rows } = await dbQuery(
    'SELECT post_fingerprint, correction, created_at FROM detector_corrections WHERE handle = ? ORDER BY created_at DESC LIMIT 200',
    [handle.toLowerCase()],
  );
  return rows.map((r) => ({
    postFingerprint: String(r.post_fingerprint),
    correction: String(r.correction) as DetectorCorrectionKind,
    createdAt: Number(r.created_at),
  }));
}
