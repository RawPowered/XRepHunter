import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(dir, { recursive: true });

// Minimal 16x16 PNG (blue circle on black) — valid PNG bytes
const png16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVQ4T2NkYGD4z0ABYBw1gGE0DBhGQ8NgGA0DBhGQDwB5XwEAAf//AwB5FQF0p8p8YQAAAABJRU5ErkJggg==',
  'base64',
);

for (const size of [16, 32, 48, 96, 128]) {
  writeFileSync(join(dir, `icon-${size}.png`), png16);
}
