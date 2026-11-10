// Select a host in a clean test checkout; never mix two generations of DSH peers.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const version = process.argv[2];

// Each DSH generation pins its own Cordis / Schemastery / Loader line. Installing a newer
// Cordis than the selected `dsh-*` peers require would give the test two Context instances.
// `dsh-tool-executor-native` only exists from the 0.2.2 line, so older hosts must not depend on it.
const profiles = {
  '0.1.7-rc.2': { cordis: '4.0.5', schemastery: '3.18.5', loader: '1.0.6', executor: null },
  '0.2.0-rc.2': { cordis: '4.0.5', schemastery: '3.18.5', loader: '1.0.6', executor: null },
  '0.2.1-rc.1': { cordis: '4.0.5', schemastery: '3.18.5', loader: '1.0.6', executor: null },
  '0.2.1-rc.2': { cordis: '4.0.5', schemastery: '3.18.5', loader: '1.0.6', executor: null },
  '0.2.1-rc.5': { cordis: '4.0.5', schemastery: '3.18.5', loader: '1.0.6', executor: null },
  '0.2.2-rc.1': { cordis: '4.1.0', schemastery: '3.19.0', loader: '1.1.0', executor: '0.2.2-rc.1' },
};

assert.ok(Object.hasOwn(profiles, version), 'Select a supported test host.');
assert.ok(!existsSync('node_modules'), 'Select the host before installing test dependencies.');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = new Set(manifest.engines.dsh.split('||').map(host => host.trim()));
assert.ok(declared.has(version), `engines.dsh does not admit the selected host ${version}.`);
const profile = profiles[version];
// The checked-in manifest is the default host; its executor devDependency is what the suite mounts.
assert.equal(manifest.devDependencies['@deepseek-ai/dsh-tool-executor-native'], manifest.engines.dsh.split('||').pop().trim(),
  'The default development host must depend on the native tool executor the integration suite mounts.');
for (const name of Object.keys(manifest.devDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh-')) manifest.devDependencies[name] = version;
}
if (!profile.executor) delete manifest.devDependencies['@deepseek-ai/dsh-tool-executor-native'];
else manifest.devDependencies['@deepseek-ai/dsh-tool-executor-native'] = profile.executor;
manifest.devDependencies['@deepseek-ai/cordis'] = profile.cordis;
manifest.devDependencies['@deepseek-ai/schemastery'] = profile.schemastery;
manifest.devDependencies['@deepseek-ai/cordis-plugin-loader'] = profile.loader;
writeFileSync('package.json', JSON.stringify(manifest, null, 2) + '\n');
if (existsSync('package-lock.json')) unlinkSync('package-lock.json');
console.log(`Selected DSH ${version} (Cordis ${profile.cordis}, Schemastery ${profile.schemastery}, Loader ${profile.loader}, executor ${profile.executor ?? 'none'}); run npm install --ignore-scripts in this test checkout.`);
