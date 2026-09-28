import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
const rows = yaml.load(readFileSync(manifest.dsh.bundle.patch, 'utf8'));
assert.equal(rows[0].insert[0].name, manifest.name);
for (const file of ['lib/index.js', 'skills/open-code-review/SKILL.md', 'README.md', 'README.zh.md', 'LICENSE', 'NOTICE']) {
  assert.ok(existsSync(file), `Missing release file: ${file}`);
}
assert.equal(manifest.dependencies['@alibaba-group/open-code-review'], '1.12.10');
assert.ok(!manifest.scripts.postinstall && !manifest.scripts.prepare, 'Plugin must be installable without build scripts.');
console.log('Bundle manifest, runtime files, skill and pinned OCR dependency are valid.');
