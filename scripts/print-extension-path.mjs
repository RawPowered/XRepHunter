import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extDir = resolve(root, 'extension');
console.log('');
console.log('XRepHunter extension ready.');
console.log('Load unpacked in Chrome/Edge →');
console.log(extDir);
console.log('');
