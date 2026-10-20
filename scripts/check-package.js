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

// An `engines.dsh` range decides DSH admission alone, so it must be an explicit
// list of exact verified versions and must agree with every declared DSH peer.
const hosts = manifest.engines.dsh.split('||').map(host => host.trim());
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
for (const host of hosts) assert.match(host, exactVersion, `engines.dsh contains a non-exact version: ${host}`);
assert.equal(new Set(hosts).size, hosts.length, 'engines.dsh lists a version twice.');
assert.ok(hosts.includes(manifest.devDependencies['@deepseek-ai/dsh-tools']), 'The default development host must be declared in engines.dsh.');
for (const [name, range] of Object.entries(manifest.peerDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(range, manifest.engines.dsh, `${name} must expose the same verified hosts as engines.dsh.`);
}
console.log(`Bundle manifest, runtime files, skill, pinned OCR dependency and ${hosts.length} verified DSH hosts are valid.`);
