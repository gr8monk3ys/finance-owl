// The package is "type": "module", so Node would read dist/cjs/*.js as ESM.
// A nested manifest marks that subtree as CommonJS.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/cjs');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
