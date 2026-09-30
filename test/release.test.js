import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { verifyRelease } from '../scripts/verify-release.js';

function archive(entries) {
  const blocks = [];
  const octal = (value, width) => `${value.toString(8).padStart(width - 1, '0')}\0`;
  for (const { name, data = '', type = '0' } of entries) {
    const bytes = Buffer.from(data);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write(octal(0o644, 8), 100, 8);
    header.write(octal(0, 8), 108, 8);
    header.write(octal(0, 8), 116, 8);
    header.write(octal(bytes.length, 12), 124, 12);
    header.write(octal(0, 12), 136, 12);
    header.fill(32, 148, 156);
    header.write(type, 156, 1);
    header.write('ustar\0', 257, 6);
    header.write('00', 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);
    blocks.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

test('release gate validates tag, checksum, production files and npm idempotence', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-release-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source');
  await mkdir(path.join(source, 'lib'), { recursive: true });
  const manifest = {
    name: 'dsh-open-code-review',
    version: '1.2.3',
    type: 'module',
    exports: { '.': './lib/index.js' },
    files: ['lib'],
    dependencies: { '@alibaba-group/open-code-review': '1.12.10' },
    peerDependencies: { '@deepseek-ai/dsh-tools': '0.2.0-rc.2' },
    engines: { dsh: '0.2.0-rc.2' },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  };
  const lock = {
    name: manifest.name,
    version: manifest.version,
    lockfileVersion: 3,
    packages: { '': { name: manifest.name, version: manifest.version, dependencies: manifest.dependencies, peerDependencies: manifest.peerDependencies } },
  };
  await writeFile(path.join(source, 'package.json'), JSON.stringify(manifest));
  await writeFile(path.join(source, 'package-lock.json'), JSON.stringify(lock));
  await writeFile(path.join(source, 'lib/index.js'), 'export const ok = true;\n');
  const releaseEntries = [
    { name: 'package/package.json', data: JSON.stringify(manifest) },
    { name: 'package/lib/index.js', data: 'export const ok = true;\n' },
  ];
  const release = path.join(dir, 'release.tgz');
  const repacked = path.join(dir, 'repacked.tgz');
  const checksums = path.join(dir, 'SHA256SUMS');
  const metadata = path.join(dir, 'npm.json');
  const releaseBytes = archive(releaseEntries);
  await writeFile(release, releaseBytes);
  await writeFile(repacked, archive(releaseEntries));
  await writeFile(checksums, `${createHash('sha256').update(releaseBytes).digest('hex')}  release.tgz\n`);
  const args = ['--tag', 'v1.2.3', '--source', source, '--tarball', release, '--checksums', checksums, '--repacked', repacked];

  await t.test('valid release is ready, identical npm version is skipped', async () => {
    const ready = await verifyRelease(args);
    assert.equal(ready.status, 'ready-to-publish');
    assert.equal(ready.version, '1.2.3');
    await writeFile(metadata, JSON.stringify({ name: manifest.name, version: manifest.version, dist: { integrity: ready.integrity } }));
    assert.equal((await verifyRelease([...args, '--npm-metadata', metadata])).status, 'existing-identical');
  });

  await t.test('tag and lock versions must agree', async () => {
    await assert.rejects(verifyRelease(['--tag', 'v1.2.4', ...args.slice(2)]), /tag v1\.2\.4 differs/);
    await writeFile(path.join(source, 'package-lock.json'), JSON.stringify({ ...lock, version: '1.2.4' }));
    await assert.rejects(verifyRelease(args), /package-lock\.json version/);
    await writeFile(path.join(source, 'package-lock.json'), JSON.stringify(lock));
  });

  await t.test('changed checksum or production file is rejected', async () => {
    await writeFile(checksums, `${'0'.repeat(64)}  release.tgz\n`);
    await assert.rejects(verifyRelease(args), /SHA256SUMS mismatch/);
    await writeFile(checksums, `${createHash('sha256').update(releaseBytes).digest('hex')}  release.tgz\n`);
    await writeFile(repacked, archive([releaseEntries[0], { name: 'package/lib/index.js', data: 'export const changed = true;\n' }]));
    await assert.rejects(verifyRelease(args), /release file package\/lib\/index\.js differs/);
    await writeFile(repacked, archive(releaseEntries));
  });

  await t.test('unsafe archive member is rejected even with a matching checksum', async () => {
    const unsafe = archive([...releaseEntries, { name: 'package/../escape', data: 'bad' }]);
    await writeFile(release, unsafe);
    await writeFile(checksums, `${createHash('sha256').update(unsafe).digest('hex')}  release.tgz\n`);
    await assert.rejects(verifyRelease(args), /unsafe path/);
    const linked = archive([...releaseEntries, { name: 'package/lib/link', type: '2' }]);
    await writeFile(release, linked);
    await writeFile(checksums, `${createHash('sha256').update(linked).digest('hex')}  release.tgz\n`);
    await assert.rejects(verifyRelease(args), /non-regular file/);
    await writeFile(release, releaseBytes);
    await writeFile(checksums, `${createHash('sha256').update(releaseBytes).digest('hex')}  release.tgz\n`);
  });

  await t.test('published version with different integrity is rejected', async () => {
    await writeFile(metadata, JSON.stringify({ dist: { integrity: `sha512-${'A'.repeat(88)}` } }));
    await assert.rejects(verifyRelease([...args, '--npm-metadata', metadata]), /different integrity/);
  });
});
