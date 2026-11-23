# DSH Open Code Review 0.1.5

Add admission for DeepSeek Harness **0.2.2-rc.3** (the local runtime/CLI) and
**0.2.2-rc.5** (the newest published `latest`/`next` kernel). The manifest now
explicitly supports **0.1.7-rc.2, 0.2.0-rc.2, 0.2.1-rc.1, 0.2.1-rc.2, 0.2.1-rc.5,
0.2.2-rc.1, 0.2.2-rc.3 and 0.2.2-rc.5**.
The plugin's host API usage is unchanged: `defineTool`, `ctx.tools.register`,
`ctx.skills.register`, `ctx.subprocess.spawn`, `ctx.sandbox.confine` and
`ctx.sandboxPolicy.resolve`, plus the approval and failure-classification
helpers, keep compatible signatures, so the native tools, skill, sandbox and
managed-process integration are retained unchanged.

- Default `ocr_preview` / `ocr_rules` and `/open-code-review` use the current
  DSH model. Optional full OCR-managed mode remains opt-in
  (`enableManagedReview: true`).
- OCR stays pinned at **1.12.10**; no separate key is needed in default mode.
- Development dependencies and the lockfile now target **0.2.2-rc.5** (Cordis
  4.1.0, Schemastery 3.19.0, `@deepseek-ai/cordis-plugin-loader` 1.1.0). The
  non-map `lib/` trees across `0.2.2-rc.2`–`0.2.2-rc.5` are byte-identical for
  the consumed DSH service packages; structured error subclasses from
  `@deepseek-ai/dsh-error` and session-scoped `registerWritableRoot` on
  `dsh-sandbox-policy` are additive and preserve all existing contracts.
- Verified on Linux: `0.2.2-rc.5`, `0.2.2-rc.3`, `0.2.2-rc.1` and `0.2.1-rc.5`
  all pass `npm run check`, 20/20 unit tests, and 3/3 integration tests with
  real DSH sandboxing (Landlock full enforcement) and the packaged OCR binary;
  `0.2.2-rc.3` CLI isolated-profile install, `--dump-config`, and removal
  smoke tests also pass.
- CI covers all eight kernels across Linux, macOS and Windows, with
  `0.2.2-rc.5` as the default kernel (`npm ci` from the lockfile) and the
  others pinned via `scripts/select-test-host.js`.
- Upgrade/API migration details: [UPGRADE.zh.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/UPGRADE.zh.md).
- Validation and its limits: [VALIDATION.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/VALIDATION.md).

The same verified archive is intended for [npm](https://www.npmjs.com/package/dsh-open-code-review)
and GitHub Releases. Install the npm source into your actual profile for package-name update checks:

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.5 --save-exact --ignore-scripts
```

The pinned GitHub Release URL:

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/download/v0.1.5/dsh-open-code-review.tgz --ignore-scripts
```

Reload as prompted and start a new conversation if needed. Optional native
OCR dependencies must remain enabled; the upstream postinstall script is unnecessary for this adapter. Earlier release assets are preserved.

This is a community adapter. Market listing remains subject to catalog review;
GitHub publication alone does not establish listing. No live LLM provider request
was made during the compatibility checks.
