// SPDX-License-Identifier: Apache-2.0
import { createRequire } from 'node:module';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { approveEscalation, validateEscalationArgs, classifyRunnerFailure, matchesSignature } from '@deepseek-ai/dsh-sandbox';

const require = createRequire(import.meta.url);

/** Resolve the pinned upstream native package; never launch OCR's updater or install at runtime. */
export async function packagedBinary(config = {}) {
  if (config.ocrPath) {
    if (!path.isAbsolute(config.ocrPath)) throw new Error('ocrPath must be an absolute native OCR executable path.');
    return config.ocrPath;
  }
  const manifestPath = require.resolve('@alibaba-group/open-code-review/package.json');
  const upstream = require(manifestPath);
  const platform = `${process.platform}-${process.arch}`;
  const packageName = Object.keys(upstream.optionalDependencies || {}).find(name => name.endsWith(`-${platform}`));
  if (!packageName) throw new Error(`OCR does not ship a binary for ${platform}. Configure ocrPath with a compatible binary.`);
  try {
    const upstreamRequire = createRequire(manifestPath);
    const platformRoot = path.dirname(upstreamRequire.resolve(`${packageName}/package.json`));
    const binary = path.join(platformRoot, 'bin', process.platform === 'win32' ? 'opencodereview.exe' : 'opencodereview');
    await access(binary, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return binary;
  } catch {
    throw new Error(`Missing OCR native dependency ${packageName}@${upstream.version}. Reinstall this plugin with optional dependencies enabled, or set ocrPath. No automatic download was attempted.`);
  }
}

export function redact(message) {
  return String(message)
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gh[opusr]_[A-Za-z0-9_]{8,})\b/g, '[redacted]')
    .replace(/((?:api[_-]?key|auth[_-]?token|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

/** All command execution goes through DSH's sandbox and managed subprocess lifecycle. */
export function createRunner(ctx, config, lifetimeSignal) {
  return async function run(argv, cwd, exec, args, timeoutMs) {
    validateEscalationArgs(args.sandbox_permissions, args.justification);
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([exec.signal, lifetimeSignal, deadline]);
    signal.throwIfAborted();
    const standing = ctx.sandboxPolicy.resolve(exec.agent ? { session: exec.agent.session } : {});
    const policy = { ...standing };
    if (args.sandbox_permissions) {
      policy.mode = await approveEscalation({
        requestedMode: args.sandbox_permissions,
        justification: args.justification,
        effectiveMode: standing.mode,
        subject: 'OCR command',
      }, { approver: ctx.get('approval'), agent: exec.agent, callId: exec.callId, toolName: exec.name, signal });
    }
    const binary = await packagedBinary(config);
    let command = [binary, ...argv];
    let confinement;
    if (policy.mode !== 'danger-full-access') {
      confinement = await ctx.sandbox.confine(command, policy, signal);
      command = confinement.argv;
    }
    const env = { OCR_NO_UPDATE: '1', NO_COLOR: '1', GIT_TERMINAL_PROMPT: '0' };
    for (const key of config.forwardEnv) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || /^(DSH_|HOME$|USERPROFILE$|PATH$)/i.test(key)) throw new Error(`Unsupported forwardEnv entry: ${key}`);
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const handle = ctx.subprocess.spawn({
      argv: command, cwd, env, signal, graceMs: 1000,
      stdio: { stdin: 'ignore', stdout: { maxBytes: config.maxOutputBytes }, stderr: { maxBytes: 65536 } },
    });
    let outcome;
    try {
      outcome = await handle.done;
    } finally {
      // Quiescence includes descendants, including on cancellation or plugin unload.
      handle.terminate();
      await handle.waitForExit();
    }
    if (signal.aborted) {
      if (deadline.aborted && !exec.signal.aborted && !lifetimeSignal.aborted) throw new Error(`OCR timed out after ${timeoutMs} ms; its process was stopped.`);
      signal.throwIfAborted();
    }
    const out = handle.collected.stdout.readFrom(0);
    const err = handle.collected.stderr.readFrom(0);
    if (out.lossy) throw new Error(`OCR output exceeded ${config.maxOutputBytes} bytes. Reduce the review scope or increase maxOutputBytes; no partial JSON was accepted.`);
    if (outcome.exitCode !== 0) {
      const details = redact(err.text || out.text).slice(-4000);
      if (confinement && classifyRunnerFailure(outcome.exitCode, err.text, confinement.runnerFailureRules)) {
        throw new Error(`OCR sandbox runner failed before executing the command: ${details}`);
      }
      if (confinement && matchesSignature(outcome.exitCode, err.text, confinement.denialSignatures)) {
        throw new Error(`[sandbox: file access denied under ${policy.mode} mode]\n${details}\nRequest a wider sandbox_permissions with a justification only if needed; do not bypass the sandbox.`);
      }
      throw new Error(`OCR failed (exit ${outcome.exitCode}, signal ${outcome.signal || 'none'}): ${details}`);
    }
    return out.text;
  };
}
