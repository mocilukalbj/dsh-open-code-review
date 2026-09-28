import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { buildArguments, parseResult, repository } from '../lib/arguments.js';

test('range and commit scopes stay identical across preview and rules', () => {
  for (const scope of [{ from: 'main' }, { from: 'main', to: 'feature' }, { commit: 'abc123' }]) {
    const preview = buildArguments('preview', scope);
    const rules = buildArguments('rules', { ...scope, paths: ['src/a.ts'] });
    assert.deepEqual(preview.slice(3), rules.slice(3, -2));
  }
  assert.ok(buildArguments('preview', { from: 'main' }).includes('--to=HEAD'));
});

test('rejects ambiguous modes and option injection', () => {
  for (const args of [{ commit: 'a', from: 'b' }, { to: 'HEAD' }, { from: '--output=/tmp/pwn' }, { commit: 'bad\nref' }, { from: '' }]) {
    assert.throws(() => buildArguments('preview', args));
  }
});

test('paths and background remain literal argv, including leading-dash filenames', () => {
  const payload = '$(touch /tmp/never) `echo test` " and \' literal';
  const argv = buildArguments('preview', { background: payload });
  assert.ok(argv.includes(`--background=${payload}`));
  assert.deepEqual(buildArguments('rules', { paths: ['-strange.js', 'src/a b.ts'] }).slice(-3), ['--', '-strange.js', 'src/a b.ts']);
  for (const file of ['../a', 'src/../../a', '/etc/passwd', 'C:\\secret', '..\\secret', 'bad\0name']) {
    assert.throws(() => buildArguments('rules', { paths: [file] }));
  }
  assert.throws(() => buildArguments('rules', { paths: [] }));
  assert.throws(() => buildArguments('rules', { paths: Array(201).fill('a.js') }));
});

test('uses the session workspace, never the harness process cwd', () => {
  const workspace = path.join(tmpdir(), 'project');
  const exec = { agent: { session: { header: { cwd: workspace } } } };
  assert.equal(repository({}, exec), workspace);
  assert.equal(repository({ repo: 'subproject' }, exec), path.join(workspace, 'subproject'));
  assert.throws(() => repository({}, {}), /No session workspace/);
  assert.throws(() => repository({ repo: 'relative' }, {}), /absolute/);
});

test('rejects malformed, incompatible, and incomplete JSON', () => {
  for (const output of ['', 'log\n{}', 'null', '[]', '{}', '{"schema_version":"2","reviewable_files":[]}']) {
    assert.throws(() => parseResult('preview', output));
  }
  const valid = { schema_version: '1', reviewable_files: [] };
  assert.deepEqual(parseResult('preview', JSON.stringify(valid)), valid);
  assert.throws(() => parseResult('rules', JSON.stringify(valid)), /groups/);
});
