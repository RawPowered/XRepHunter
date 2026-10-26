import { getScoreCache } from '../storage';
import { dbQuery } from './bridge';
import { saveReputationSnapshot, upsertAccountFromScan } from './repositories/accounts';

const MIGRATED_KEY = 'sqliteScoresMigrated';

export async function migrateScoresFromStorageIfNeeded(): Promise<void> {
  const flag = await browser.storage.local.get(MIGRATED_KEY);
  if (flag[MIGRATED_KEY]) return;

  const { rows } = await dbQuery('SELECT COUNT(*) AS c FROM accounts');
  const count = Number(rows[0]?.c ?? 0);
  if (count > 0) {
    await browser.storage.local.set({ [MIGRATED_KEY]: true });
    return;
  }

  const scores = await getScoreCache();
  for (const result of Object.values(scores)) {
    await upsertAccountFromScan(result, null);
    await saveReputationSnapshot(result);
  }
  await browser.storage.local.set({ [MIGRATED_KEY]: true });
}
