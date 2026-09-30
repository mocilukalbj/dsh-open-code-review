#!/usr/bin/env node

// Validate a GitHub Release asset against the tag checkout before npm publish.
// The archive is read as data; no file from it is extracted or executed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const FIELDS = ['name', 'version', 'dependencies', 'peerDependencies', 'peerDependenciesMeta', 'exports', 'files', 'engines', 'dsh'];
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

function options(args) {
  const allowed = new Set(['tag', 'source', 'tarball', 'checksums', 'npm-metadata', 'repacked']);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith('--') || !allowed.has(flag.slice(2)) || value === undefined || value.startsWith('--')) {
      throw new Error('usage: verify-release.js --tag vX.Y.Z --source DIR --tarball FILE --checksums FILE --repacked FILE [--npm-metadata FILE]');
    }
    const key = flag.slice(2);
    if (parsed[key] !== undefined) throw new Error(`duplicate option ${flag}`);
    parsed[key] = value;
  }
  for (const required of ['tag', 'source', 'tarball', 'checksums', 'repacked']) {
    if (!parsed[required]) throw new Error(`missing --${required}`);
  }
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(parsed.tag)) throw new Error(`invalid release tag ${parsed.tag}`);
  return parsed;
}

function octal(field, label) {
  const value = field.toString('ascii').replace(/\0.*$/, '').trim();
  if (!/^[0-7]+$/.test(value)) throw new Error(`invalid tar ${label}`);
  return Number.parseInt(value, 8);
}

function tarText(field) {
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
}

function archiveFiles(gzip, label) {
  if (gzip.length > MAX_ARCHIVE_BYTES) throw new Error(`${label} exceeds size limit`);
  const tar = gunzipSync(gzip, { maxOutputLength: MAX_ARCHIVE_BYTES });
  const files = new Map();
  let offset = 0;
  let ended = false;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      ended = true;
      if (!tar.subarray(offset).every(byte => byte === 0)) throw new Error(`${label} has trailing tar data`);
      break;
    }
    const recorded = octal(header.subarray(148, 156), 'checksum');
    const calculated = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (recorded !== calculated) throw new Error(`${label} has invalid tar header checksum`);
    const type = header[156];
    if (type !== 0 && type !== 48) throw new Error(`${label} contains a non-regular file`);
    const prefix = tarText(header.subarray(345, 500));
    const name = `${prefix ? `${prefix}/` : ''}${tarText(header.subarray(0, 100))}`;
    const parts = name.split('/');
    if (parts[0] !== 'package' || parts.length < 2 || parts.some(part => !part || part === '.' || part === '..') || name.includes('\\')) {
      throw new Error(`${label} contains unsafe path ${JSON.stringify(name)}`);
    }
    if (files.has(name)) throw new Error(`${label} contains duplicate path ${name}`);
    const size = octal(header.subarray(124, 136), 'file size');
    const dataStart = offset + 512;
    const next = dataStart + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || next > tar.length) throw new Error(`${label} has truncated file ${name}`);
    files.set(name, tar.subarray(dataStart, dataStart + size));
    offset = next;
  }
  if (!ended || !files.has('package/package.json')) throw new Error(`${label} is missing its tar terminator or package.json`);
  return files;
}

function compareManifest(source, packed) {
  for (const field of FIELDS) {
    assert.deepEqual(packed[field], source[field], `release package.json ${field} differs from tag checkout`);
  }
}

function compareArchive(release, rebuilt) {
  assert.deepEqual([...release.keys()].sort(), [...rebuilt.keys()].sort(), 'release file list differs from tag npm pack');
  for (const [name, bytes] of release) {
    if (!bytes.equals(rebuilt.get(name))) throw new Error(`release file ${name} differs from tag npm pack`);
  }
}

function expectedChecksum(text, filename) {
  const matches = text.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})  \*?(.+)$/.exec(line))
    .filter(match => match && match[2] === filename);
  if (matches.length !== 1) throw new Error(`SHA256SUMS must contain exactly one entry for ${filename}`);
  return matches[0][1].toLowerCase();
}

export async function verifyRelease(args) {
  const input = options(args);
  if (await realpath(input.tarball) === await realpath(input.repacked)) {
    throw new Error('--repacked must be an independent tag npm pack, not the release tarball');
  }
  const source = path.resolve(input.source);
  const [sourceManifest, lock, releaseBytes, checksumText] = await Promise.all([
    readFile(path.join(source, 'package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(source, 'package-lock.json'), 'utf8').then(JSON.parse),
    readFile(input.tarball),
    readFile(input.checksums, 'utf8'),
  ]);
  const tagVersion = input.tag.slice(1);
  if (sourceManifest.version !== tagVersion || lock.version !== tagVersion || lock.packages?.['']?.version !== tagVersion) {
    throw new Error(`tag ${input.tag} differs from source package.json or package-lock.json version`);
  }
  if (sourceManifest.name !== lock.name || sourceManifest.name !== lock.packages?.['']?.name) throw new Error('source package and lock names differ');
  for (const field of ['dependencies', 'peerDependencies']) {
    assert.deepEqual(lock.packages[''][field], sourceManifest[field], `source lock ${field} differs from package.json`);
  }
  const checksum = createHash('sha256').update(releaseBytes).digest('hex');
  const filename = path.basename(input.tarball);
  if (checksum !== expectedChecksum(checksumText, filename)) throw new Error(`SHA256SUMS mismatch for ${filename}`);
  const releaseFiles = archiveFiles(releaseBytes, 'release tarball');
  const packedManifest = JSON.parse(releaseFiles.get('package/package.json').toString('utf8'));
  compareManifest(sourceManifest, packedManifest);
  const rebuiltBytes = await readFile(input.repacked);
  const rebuiltFiles = archiveFiles(rebuiltBytes, 'tag npm pack');
  compareArchive(releaseFiles, rebuiltFiles);

  const integrity = `sha512-${createHash('sha512').update(releaseBytes).digest('base64')}`;
  let status = 'ready-to-publish';
  if (input['npm-metadata']) {
    const metadata = JSON.parse(await readFile(input['npm-metadata'], 'utf8'));
    const published = typeof metadata === 'string' ? metadata : metadata.dist?.integrity ?? metadata.integrity;
    if (typeof published !== 'string') throw new Error('npm metadata is missing dist.integrity');
    if (metadata.name && metadata.name !== sourceManifest.name) throw new Error('npm metadata package name differs from release');
    if (metadata.version && metadata.version !== tagVersion) throw new Error('npm metadata version differs from release');
    if (published !== integrity) throw new Error('npm already has this version with different integrity');
    status = 'existing-identical';
  }
  return { status, name: sourceManifest.name, version: tagVersion, sha256: checksum, integrity };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await verifyRelease(process.argv.slice(2))));
  } catch (error) {
    console.error(`verify-release: ${error.message}`);
    process.exitCode = 1;
  }
}
