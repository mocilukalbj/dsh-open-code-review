import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, redact } from '../lib/runner.js';

function fixture(options = {}) {
  const events = [];
  const caller = new AbortController();
  const lifetime = new AbortController();
  const config = { ocrPath: process.execPath, maxOutputBytes: 4096, forwardEnv: [] };
  let spec;
  const ctx = {
    sandboxPolicy: { resolve: () => ({ mode: options.mode || 'read-only', workspaceRoot: '/repo' }) },
    sandbox: { confine: async argv => {
      events.push('confine');
      if (options.deny) throw new Error('sandbox unavailable');
      return { argv: ['sandbox-runner', ...argv], denialSignatures: ['permission denied'], runnerFailureRules: [] };
    } },
    get: () => undefined,
    subprocess: { spawn: input => {
      events.push('spawn'); spec = input;
      const done = options.pending ? new Promise(resolve => input.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true })) : Promise.resolve({ exitCode: options.exitCode ?? 0, signal: null });
      return {
        done,
        terminate: () => events.push('terminate'),
        waitForExit: async () => { events.push('wait'); return true; },
        collected: {
          stdout: { readFrom: () => ({ text: options.stdout || '{}', lossy: !!options.lossy }) },
          stderr: { readFrom: () => ({ text: options.stderr || '', lossy: false }) },
        },
      };
    } },
  };
  return { events, caller, lifetime, config, ctx, getSpec: () => spec,
    run: (args = {}, timeout = 60000) => createRunner(ctx, config, lifetime.signal)(['delegate', 'preview'], '/repo', { signal: caller.signal, name: 'ocr_preview', callId: 'test' }, args, timeout) };
}

test('uses the host sandbox and scrubbed subprocess seam, then joins processes', async () => {
  const f = fixture();
  await f.run();
  assert.deepEqual(f.events, ['confine', 'spawn', 'terminate', 'wait']);
  assert.equal(f.getSpec().argv[0], 'sandbox-runner');
  assert.equal(f.getSpec().env.OCR_NO_UPDATE, '1');
  assert.equal(f.getSpec().env.DEEPSEEK_API_KEY, undefined);
  assert.equal(f.getSpec().stdio.stdin, 'ignore');
});

test('sandbox refusal never falls back to unconfined execution', async () => {
  const f = fixture({ deny: true });
  await assert.rejects(f.run(), /sandbox unavailable/);
  assert.deepEqual(f.events, ['confine']);
});

test('escalation without host approval fails before spawn', async () => {
  const f = fixture();
  await assert.rejects(f.run({ sandbox_permissions: 'danger-full-access', justification: 'Needs OCR session persistence' }));
  assert.ok(!f.events.includes('spawn'));
  await assert.rejects(f.run({ sandbox_permissions: 'danger-full-access' }));
});

test('nonzero exit with valid JSON is still an error', async () => {
  const f = fixture({ exitCode: 1, stdout: '{"comments":[]}', stderr: 'provider failed' });
  await assert.rejects(f.run(), /provider failed/);
});

test('sandbox denial is identified and truncated JSON is never accepted', async () => {
  await assert.rejects(fixture({ exitCode: 1, stderr: 'permission denied' }).run(), /sandbox: file access denied/);
  await assert.rejects(fixture({ lossy: true }).run(), /exceeded/);
});

for (const reason of ['caller', 'lifetime']) {
  test(`${reason} cancellation stops and joins the process`, async () => {
    const f = fixture({ pending: true });
    const p = f.run();
    setTimeout(() => f[reason].abort(new Error(`${reason} stopped`)), 20);
    await assert.rejects(p, new RegExp(`${reason} stopped`));
    assert.deepEqual(f.events.slice(-2), ['terminate', 'wait']);
  });
}

test('deadline is surfaced as a failure', async () => {
  const f = fixture({ pending: true });
  const hold = setTimeout(() => {}, 1000);
  try { await assert.rejects(f.run({}, 15), /timed out/); }
  finally { clearTimeout(hold); }
});

test('diagnostic credential shapes are redacted', () => {
  assert.equal(redact('Authorization: Bearer sk-secret123456 api_key=12345'), 'Authorization: [redacted] [redacted] api_key=[redacted]');
});
