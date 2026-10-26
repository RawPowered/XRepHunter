import { dbExportBytes, dbImportBytes } from './bridge';

export async function exportDatabaseFile(): Promise<{ bytes: Uint8Array; filename: string }> {
  const bytes = await dbExportBytes();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { bytes, filename: `xrephunter-${y}${m}${day}.db` };
}

export async function importDatabaseFile(bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<void> {
  await dbImportBytes(bytes, mode);
}
