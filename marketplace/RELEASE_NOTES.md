# DSH Open Code Review 0.1.4

Add admission for DeepSeek Harness **0.2.2-rc.1** — the newest published kernel
and the one the development machine runs. The manifest now explicitly supports
**0.1.7-rc.2, 0.2.0-rc.2, 0.2.1-rc.1, 0.2.1-rc.2, 0.2.1-rc.5 and 0.2.2-rc.1**.
The plugin's host API usage is unchanged: `defineTool`, `ctx.tools.register`,
`ctx.skills.register`, `ctx.subprocess.spawn`, `ctx.sandbox.confine` and
`ctx.sandboxPolicy.resolve`, plus the approval and failure-classification
helpers, keep the same signatures, so the native tools, skill, sandbox and
managed-process integration are retained.

What did change in 0.2.2-rc.1 is that tool registration moved dispatch into an
executor mounted by the composition (`@deepseek-ai/dsh-tool-executor-native`;
`dsh-base` mounts it by default). That required migrating only the plugin's
integration test suite: mount the executor and use its batch format
`{ calls: [{ type: 'tool-call', id, name, arguments: JSON string }], signal }`
reading `batch.results[0].result`, with generation detection so the same tests
still run on older kernels.

- Default `ocr_preview` / `ocr_rules` and `/open-code-review` use the current
  DSH model. Optional full OCR-managed mode remains opt-in
  (`enableManagedReview: true`).
- OCR stays pinned at **1.12.10**; no separate key is needed in default mode.
- Development dependencies now target 0.2.2-rc.1 (Cordis 4.1.0, Schemastery
  3.19.0, `@deepseek-ai/cordis-plugin-loader` 1.1.0). Cordis and Schemastery
  peer ranges widened to `~4.0.4 || ~4.1.0` and `~3.18.4 || ~3.19.0`; DSH's
  admission guard uses `engines.dsh` and, in its absence, the `dsh-*` peers.
- Verified on 0.2.2-rc.1 in real Linux: 3/3 integration tests with bwrap and
  the packaged OCR binary, 20/20 unit tests, and `npm run check` passing. The
  same suite also passed locally on 0.2.1-rc.5, 0.2.1-rc.2 and 0.1.7-rc.2, which
  keep the legacy single-call dispatch path.
- CI covers all six kernels across Linux, macOS and Windows, with
  `0.2.2-rc.1` as the default kernel (`npm ci` from the lockfile) and the
  others pinned via `scripts/select-test-host.js`.
- Upgrade/API migration details: [UPGRADE.zh.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/UPGRADE.zh.md).
- Validation and its limits: [VALIDATION.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/VALIDATION.md).

The same verified archive is also published to [npm](https://www.npmjs.com/package/dsh-open-code-review).
Install the npm source into your actual profile for package-name update checks:

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.4 --save-exact --ignore-scripts
```

The pinned GitHub Release remains available:

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/download/v0.1.4/dsh-open-code-review.tgz --ignore-scripts
```

Reload as prompted and start a new conversation if needed. Optional native
OCR dependencies must remain enabled; the upstream postinstall script is unnecessary for this adapter. Earlier release assets are preserved.

This is a community adapter. Market listing remains subject to catalog review;
GitHub publication alone does not establish listing. No live LLM provider request
was made during the compatibility checks.
