// SPDX-License-Identifier: Apache-2.0
import path from 'node:path';

function text(value, label, max = 8000) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.length > max) {
    throw new Error(`${label} must be a non-empty string without NUL, at most ${max} characters.`);
  }
  return value;
}

export function reviewScope(args) {
  if (args.commit && (args.from || args.to)) throw new Error('commit cannot be combined with from/to.');
  if (args.to && !args.from) throw new Error('to requires from.');
  const argv = [];
  for (const key of ['from', 'to', 'commit']) {
    if (args[key] === undefined) continue;
    const ref = text(args[key], key, 1024);
    if (ref.startsWith('-') || /[\r\n]/.test(ref)) throw new Error(`Invalid ${key}: Git refs must not start with - or contain newlines.`);
    argv.push(`--${key}=${ref}`);
  }
  if (args.from && !args.to) argv.push('--to=HEAD');
  return argv;
}

export function repository(args, exec) {
  const base = exec.agent?.session?.header?.cwd;
  if (!base && !args.repo) throw new Error('No session workspace. Supply an absolute repo path.');
  if (args.repo !== undefined) text(args.repo, 'repo', 32768);
  if (!base && !path.isAbsolute(args.repo)) throw new Error('repo must be absolute without a session workspace.');
  return path.resolve(base || args.repo, args.repo || '.');
}

export function buildArguments(operation, args) {
  const scope = reviewScope(args);
  const argv = operation === 'preview' ? ['delegate', 'preview', '--format=json', ...scope]
    : operation === 'rules' ? ['delegate', 'rule', '--format=json', ...scope]
    : operation === 'review' ? ['review', '--format=json', '--audience=agent', ...scope]
    : operation === 'llm-test' ? ['llm', 'test'] : null;
  if (!argv) throw new Error(`Unknown OCR operation: ${operation}`);
  for (const key of ['exclude', 'background']) {
    if (args[key] !== undefined) argv.push(`--${key}=${text(args[key], key)}`);
  }
  if (args.rule !== undefined) argv.push(`--rule=${text(args.rule, 'rule', 32768)}`);
  if (operation === 'rules') {
    if (!Array.isArray(args.paths) || args.paths.length < 1 || args.paths.length > 200) throw new Error('paths must contain 1–200 repository-relative paths.');
    for (const file of args.paths) {
      text(file, 'path', 32768);
      if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
        throw new Error('Rule paths must be repository-relative and cannot contain .. segments.');
      }
    }
    argv.push('--', ...args.paths);
  }
  return argv;
}

export function parseResult(operation, stdout) {
  if (operation === 'llm-test') return { message: stdout.trim() };
  let data;
  try { data = JSON.parse(stdout); } catch { throw new Error('OCR returned invalid JSON. No review result is available; do not interpret this as a clean review.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('OCR returned an unexpected result shape.');
  if (operation === 'preview' || operation === 'rules') {
    if (data.schema_version !== '1') throw new Error(`Unsupported OCR delegation schema: ${data.schema_version}.`);
    const field = operation === 'preview' ? 'reviewable_files' : 'groups';
    if (!Array.isArray(data[field])) throw new Error(`OCR result is missing ${field}.`);
  }
  return data;
}
