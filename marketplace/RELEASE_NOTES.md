# DSH Open Code Review 0.1.1

Fix loading on DeepSeek Harness **0.2.0-rc.2**: the old bundle was rejected
because its DSH service peers accepted only 0.1.7-rc.2. The new manifest explicitly
supports **0.1.7-rc.2 or 0.2.0-rc.2**. The required host APIs are unchanged;
the native tools, skill, sandbox and managed-process integration are retained.

- Default `ocr_preview` / `ocr_rules` and `/open-code-review` use the current
  DSH model. Optional full OCR-managed mode remains opt-in.
- OCR stays pinned at **1.12.10**; no separate key is needed in default mode.
- Development dependencies now target 0.2.0-rc.2. CI covers both hosts across
  Linux, macOS and Windows, with actual dependency-version assertions.
- Upgrade/API migration details: [UPGRADE.zh.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/UPGRADE.zh.md).
- Validation and its limits: [VALIDATION.md](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/VALIDATION.md).

The same verified archive is also published to [npm](https://www.npmjs.com/package/dsh-open-code-review).
Install the npm source into your actual profile for package-name update checks:

```sh
dsh plugin --profile web add dsh-open-code-review@0.1.1 --save-exact --ignore-scripts
```

The pinned GitHub Release remains available:

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/download/v0.1.1/dsh-open-code-review.tgz --ignore-scripts
```

Reload as prompted and start a new conversation if needed. Optional native
OCR dependencies must remain enabled; the upstream postinstall script is unnecessary for this adapter. Historical v0.1.0 assets are preserved.

This is a community adapter. Market listing remains subject to catalog review;
GitHub publication alone does not establish listing. No live LLM provider request
was made during the compatibility checks.
