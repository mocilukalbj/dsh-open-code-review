// Select a host in a clean test checkout; never mix two generations of DSH peers.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const version = process.argv[2];
assert.ok(['0.1.7-rc.2', '0.2.0-rc.2'].includes(version), 'Select a supported test host.');
assert.ok(!existsSync('node_modules'), 'Select the host before installing test dependencies.');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
for (const name of Object.keys(manifest.devDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh-')) manifest.devDependencies[name] = version;
}
writeFileSync('package.json', JSON.stringify(manifest, null, 2) + '\n');
if (existsSync('package-lock.json')) unlinkSync('package-lock.json');
console.log(`Selected DSH ${version}; run npm install --ignore-scripts in this test checkout.`);
