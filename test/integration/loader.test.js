import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import yaml from 'js-yaml';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function load(config = {}) {
  const ctx = new Context();
  const loaderFiber = ctx.plugin(Loader);
  await loaderFiber.await();
  const rows = yaml.load(await readFile(new URL('./cordis.yml', import.meta.url), 'utf8'));
  const bundle = yaml.load(await readFile(path.join(root, 'cordis.patch.yml'), 'utf8'));
  rows.push(...bundle[0].insert.map(row => ({ ...row, config })));
  for (const row of rows) {
    // Resolve the actual package entry; the row itself comes from the shipped bundle.
    const entryPath = row.name === 'dsh-open-code-review' ? path.join(root, 'lib/index.js') : require.resolve(row.name);
    row.name = pathToFileURL(entryPath).href;
  }
  await ctx.loader.root.update(rows);
  await ctx.loader.await();
  for (const entry of ctx.loader.entries()) if (entry.fiber) await entry.fiber.await();
  assert.ok(ctx.get('tools'), 'real DSH tools service must be ready');
  assert.ok(ctx.tools.schemas().some(tool => tool.name === 'ocr_preview'), 'bundle must register tools');
  return ctx;
}

let calls = 0;
async function call(ctx, name, args) {
  const result = await ctx.tools.execute({ callId: `integration-${++calls}`, name, arguments: args, signal: new AbortController().signal });
  assert.equal(result.isError, false, JSON.stringify(result));
  return result.value;
}

test('real Loader + DSH sandbox/subprocess + pinned OCR: workspace, range, commit, rules and unload', async t => {
  const repo = await mkdtemp(path.join(tmpdir(), 'dsh-ocr-integration-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  git(repo, 'init', '-b', 'main');
  await mkdir(path.join(repo, 'src'));
  await writeFile(path.join(repo, 'src/index.js'), 'export function getName(user) { return user?.name; }\n');
  await mkdir(path.join(repo, '.opencodereview'));
  await writeFile(path.join(repo, '.opencodereview/rule.json'), JSON.stringify({ rules: [{ path: '**/*.js', rule: 'Check nullable user access. BASE_RULE_MARKER' }] }));
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Integration', '-c', 'user.email=integration@example.invalid', 'commit', '-m', 'baseline');
  git(repo, 'checkout', '-b', 'feature');
  await writeFile(path.join(repo, 'src/index.js'), 'export function getName(user) { return user.name.toUpperCase(); }\n');
  await writeFile(path.join(repo, '.opencodereview/rule.json'), JSON.stringify({ rules: [{ path: '**/*.js', rule: 'Check nullable user access. FEATURE_RULE_MARKER' }] }));
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Integration', '-c', 'user.email=integration@example.invalid', 'commit', '-m', 'feature');
  const commit = git(repo, 'rev-parse', 'HEAD');
  await writeFile(path.join(repo, 'src/new.js'), 'export const value = 1;\n');
  const before = git(repo, 'status', '--porcelain');
  const ctx = await load();
  t.after(() => ctx.fiber.dispose());
  const skill = await ctx.skills.get('open-code-review');
  assert.ok(skill.content.includes('ocr_preview'));
  assert.ok(skill.invocation.userInvocable && skill.invocation.modelInvocable);
  assert.ok(!ctx.tools.schemas().some(tool => tool.name === 'ocr_review'));

  const workspace = await call(ctx, 'ocr_preview', { repo });
  assert.equal(workspace.mode, 'workspace');
  assert.ok(workspace.reviewable_files.some(file => file.path === 'src/new.js'));
  const range = await call(ctx, 'ocr_preview', { repo, from: 'main', to: 'feature' });
  assert.equal(range.mode, 'range');
  assert.equal(range.merge_base, git(repo, 'rev-parse', 'main'));
  assert.ok(range.reviewable_files.some(file => file.path === 'src/index.js'));
  const single = await call(ctx, 'ocr_preview', { repo, commit });
  assert.equal(single.mode, 'commit');
  const rules = await call(ctx, 'ocr_rules', { repo, from: 'main', to: 'feature', paths: ['src/index.js'] });
  assert.ok(JSON.stringify(rules).includes('FEATURE_RULE_MARKER'));
  const baseRules = await call(ctx, 'ocr_rules', { repo, commit: 'main', paths: ['src/index.js'] });
  // Upstream loads the rule config from the current checkout even in commit mode.
  assert.ok(JSON.stringify(baseRules).includes('FEATURE_RULE_MARKER'));
  assert.equal(git(repo, 'status', '--porcelain'), before, 'review tools must not modify the repository');

  await ctx.loader.resolve('open-code-review').fiber.dispose();
  assert.ok(!ctx.tools.schemas().some(tool => tool.name.startsWith('ocr_')));
  assert.equal(await ctx.skills.get('open-code-review'), undefined);
});

test('full OCR mode is opt-in and invalid scope becomes a normal tool error', async t => {
  const ctx = await load({ enableManagedReview: true });
  t.after(() => ctx.fiber.dispose());
  assert.ok(ctx.tools.schemas().some(tool => tool.name === 'ocr_review'));
  assert.ok(ctx.tools.schemas().some(tool => tool.name === 'ocr_llm_test'));
  const result = await ctx.tools.execute({ callId: 'invalid', name: 'ocr_preview', arguments: { repo: root, from: 'a', commit: 'b' }, signal: new AbortController().signal });
  assert.equal(result.isError, true);
  assert.ok(JSON.stringify(result).includes('cannot be combined'));
});

test('unloading an active tool joins its real sandboxed subprocess', { timeout: 15000 }, async t => {
  const repo = await mkdtemp(path.join(tmpdir(), 'dsh-ocr-unload-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  // A deterministic long-running executable fixture, with no model or network access.
  await writeFile(path.join(repo, 'delegate'), 'console.log(process.pid); setInterval(() => {}, 1000);\n');
  const ctx = await load({ ocrPath: process.execPath });
  t.after(() => ctx.fiber.dispose());
  let handle;
  const spawn = ctx.subprocess.spawn.bind(ctx.subprocess);
  ctx.subprocess.spawn = options => (handle = spawn(options));
  const resultPromise = ctx.tools.execute({ callId: 'unload', name: 'ocr_preview', arguments: { repo }, signal: new AbortController().signal });
  let pid;
  for (let attempt = 0; attempt < 200; attempt++) {
    pid = Number(handle?.collected.stdout.readFrom(0).text.trim());
    if (pid > 0) break;
    await delay(20);
  }
  assert.ok(pid > 0, 'sandboxed executable must have started');
  await ctx.loader.resolve('open-code-review').fiber.dispose();
  const result = await resultPromise;
  assert.equal(result.isError, true);
  assert.ok(JSON.stringify(result).includes('unloaded'));
  // Linux bwrap reports a namespace PID, not a host PID. Observe the owned range.
  assert.equal(await handle.waitForExit(AbortSignal.timeout(1000)), true, 'unload must join the subprocess range');
});
