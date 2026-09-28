// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { buildArguments, parseResult, repository } from './arguments.js';
import { createRunner } from './runner.js';

export const name = 'open-code-review';
export const inject = ['tools', 'skills', 'subprocess', 'sandboxPolicy', 'sandbox'];
export const Config = Schema.object({
  ocrPath: Schema.string().default('').description('Optional absolute native OCR executable. By default use the bundled official binary.'),
  enableManagedReview: Schema.boolean().default(false).description('Expose full OCR review and LLM connectivity tools. Requires separate OCR model configuration.'),
  delegateTimeoutMs: Schema.natural().min(1000).max(300000).default(60000).description('Time limit for deterministic OCR commands, in milliseconds.'),
  reviewTimeoutMs: Schema.natural().min(1000).max(3600000).default(900000).description('Time limit for OCR-managed reviews, in milliseconds.'),
  maxOutputBytes: Schema.natural().min(4096).max(67108864).default(8388608).description('Maximum captured JSON bytes. Oversized output fails explicitly.'),
  forwardEnv: Schema.array(Schema.string()).default([]).description('Explicit environment-variable names to forward to OCR, e.g. DEEPSEEK_API_KEY. Values are never stored here.'),
});

const scope = {
  repo: { type: 'string', description: 'Repository directory; defaults to the current DSH session workspace.' },
  from: { type: 'string', description: 'Base Git ref; reviews changes since merge-base with to.' },
  to: { type: 'string', description: 'Target Git ref; defaults to HEAD when from is supplied.' },
  commit: { type: 'string', description: 'One commit to review; mutually exclusive with from/to.' },
  rule: { type: 'string', description: 'Optional OCR rule.json path, relative to the repository or absolute.' },
};
const permissions = {
  sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'], description: 'Optional wider file access for this call only; requires host approval and justification. Omit normally.' },
  justification: { type: 'string', description: 'Reason for the user when requesting sandbox_permissions; both fields must be supplied together.' },
};
const skillPath = fileURLToPath(new URL('../skills/open-code-review/SKILL.md', import.meta.url));

export function apply(ctx, config) {
  const lifetime = new AbortController();
  const pending = new Set();
  const run = createRunner(ctx, config, lifetime.signal);
  const register = (toolName, description, parameters, operation) => {
    ctx.tools.register(defineTool({
      name: toolName, description, parameters: { ...parameters, ...permissions },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      // Reviews may share OCR state; serialize calls through the normal host scheduler.
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const task = (async () => {
          const cwd = repository(args, exec);
          const argv = buildArguments(operation, args);
          const timeout = operation === 'review' ? config.reviewTimeoutMs : config.delegateTimeoutMs;
          const stdout = await run(argv, cwd, exec, args, timeout);
          return parseResult(operation, stdout);
        })();
        pending.add(task);
        try { return await task; } finally { pending.delete(task); }
      },
    }));
  };
  register('ocr_preview', 'Select reviewable Git changes with Alibaba Open Code Review. Returns schema_version, scope, merge-base, reviewable_files and exclusions. Does not call an LLM. Load the open-code-review skill for the full host-model review workflow.', {
    ...scope,
    exclude: { type: 'string', description: 'Additional comma-separated exclude globs.' },
    background: { type: 'string', description: 'Brief requirements and business context (up to 8000 characters).' },
  }, 'preview');
  register('ocr_rules', 'Resolve OCR review rules for repository-relative paths, grouped by shared rule. Does not call an LLM. Pass the same scope as ocr_preview for content-aware matching. OCR loads rule.json from the current checkout, not historical Git revisions.', {
    ...scope, paths: { type: 'array', items: { type: 'string' }, required: true, description: '1–200 file paths from ocr_preview.reviewable_files.' },
  }, 'rules');
  if (config.enableManagedReview) {
    register('ocr_review', 'Run the complete OCR-managed review using its separately configured LLM. This sends code to the OCR model endpoint and can write OCR session files. Use only when the user requests OCR-managed mode; otherwise use ocr_preview and ocr_rules with the host model.', {
      ...scope,
      exclude: { type: 'string', description: 'Additional comma-separated exclude globs.' },
      background: { type: 'string', description: 'Brief requirements and business context.' },
    }, 'review');
    register('ocr_llm_test', 'Test the separately configured OCR LLM endpoint. Makes a model-service request; unnecessary for host-model delegation.', {
      repo: scope.repo,
    }, 'llm-test');
  }
  const content = readFileSync(skillPath, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  ctx.skills.register({
    name: 'open-code-review',
    description: 'Review workspace changes, branches or commits using Alibaba OCR file selection and rules, with this DSH agent as reviewer. No additional OCR API key. 中文代码审查。',
    source: 'bundled', path: skillPath, content,
  });
  ctx.effect(() => async () => {
    lifetime.abort(new Error('Open Code Review plugin unloaded.'));
    await Promise.allSettled(pending);
  }, 'stop-open-code-review-processes');
}
