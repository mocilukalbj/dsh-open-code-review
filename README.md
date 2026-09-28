# Open Code Review for DeepSeek Harness

English | [中文](README.zh.md)

A native DSH bundle that connects [Alibaba Open Code Review](https://github.com/alibaba/open-code-review) to the current agent. It registers two deterministic tools and the `/open-code-review` skill. OCR selects changed files and resolves review rules; the host agent reads code and performs the review with the session's model. No separate OCR API key is needed in this default mode.

This is a community adapter, not an Alibaba or DeepSeek official plugin. Delegation does not run OCR's complete independent agent, positioning and reflection pipeline. Optional OCR-managed mode exposes that separate CLI workflow.

## Requirements

- DeepSeek Harness **0.1.7-rc.2** (the tested host API; 0.2 is not yet supported).
- Node.js 22+, Git 2.41+ and a local Git workspace.
- Standard DSH services: tools, skills, subprocess, sandboxPolicy and sandbox. The shipped base/web profiles provide these; custom compositions must include them, plus the skill consumer (`@deepseek-ai/dsh-tool-skill`) to advertise/invoke the skill.
- OCR **1.12.10** is a pinned runtime dependency. Its optional native packages support Linux, macOS and Windows, x64/arm64. Keep optional dependencies enabled. This adapter has no build/install scripts and does not install or update anything during a review.

## Install

Install the published GitHub Release package:

```sh
dsh plugin --profile web add https://github.com/mocilukalbj/dsh-open-code-review/releases/latest/download/dsh-open-code-review.tgz
```

For a local checkout:

```sh
dsh plugin --profile web add /absolute/path/dsh-open-code-review
```

Reload/restart the profile as prompted by your host. Start a new conversation if the current preset has not refreshed its tool/skill catalog. This release must be accepted into the community catalog before it appears in dsh-market's Discover tab. See [marketplace preparation](marketplace/README.md).

In the conversation:

```text
/open-code-review Review my uncommitted changes. Focus on correctness and security.
```

Or ask the agent to use Open Code Review to review a branch against `main`, or a specific commit. The agent loads the skill and invokes the native tools. Review-only requests do not edit files.

## Tools and modes

| Tool | Default | Function |
| --- | --- | --- |
| `ocr_preview` | Enabled | Workspace/range/commit file selection and exclusions, with scope metadata. No LLM request. |
| `ocr_rules` | Enabled | Rules for 1–200 paths, grouped by content. No LLM request. |
| `ocr_review` | Opt-in | Full independent OCR review with OCR's separately configured model. |
| `ocr_llm_test` | Opt-in | Test that separately configured model endpoint. |

`repo` defaults to the **calling session's workspace**, not the harness's process directory. Agentless callers must supply an absolute repo. Range uses `from` plus `to` (default `HEAD`); `commit` is mutually exclusive. Preview and rules accept an optional `rule` file. OCR's rule configuration is loaded from the current checkout even in branch/commit modes; the refs are still forwarded for content-aware matching.

Outputs retain upstream JSON fields rather than reducing findings to a guessed schema. Delegation requires `schema_version: "1"`. Invalid JSON, nonzero exits, cancelled calls and truncated output are errors, never "clean review" results. Large changes should be reviewed in bounded batches with a coverage checklist.

## Configuration

Add a row override to your **profile's** `cordis.patch.yml` (or edit the plugin's schema-generated configuration in a supporting host):

```yaml
- id: open-code-review
  config:
    enableManagedReview: false
    delegateTimeoutMs: 60000
    reviewTimeoutMs: 900000
    maxOutputBytes: 8388608
    ocrPath: ''
    forwardEnv: []
```

| Setting | Purpose |
| --- | --- |
| `enableManagedReview` | Expose `ocr_review` and `ocr_llm_test`; default false. |
| `ocrPath` | Optional absolute path to a **native OCR executable**, not a shell command, JS launcher or `.cmd` shim. Empty uses the pinned packaged binary. Custom binaries must support delegation JSON schema 1. |
| `delegateTimeoutMs` | 1,000–300,000 ms, default 60,000. |
| `reviewTimeoutMs` | 1,000–3,600,000 ms, default 900,000. |
| `maxOutputBytes` | 4 KiB–64 MiB, default 8 MiB. Exceeding it fails explicitly. |
| `forwardEnv` | Opt-in **names** of environment variables to forward, e.g. `[DEEPSEEK_API_KEY]`. Never put key values in this list. DSH scrubs credential-shaped ambient variables by default. |

For full OCR-managed reviews, configure OCR using the upstream CLI (same version recommended), then enable `enableManagedReview`. The plugin does not copy DSH credentials or overwrite OCR configuration. Existing `~/.opencodereview/config.json` is used by upstream OCR; explicitly allowed environment variables are another option. Full mode makes external LLM requests and persists upstream session state, so it may need a per-call file-sandbox escalation. Delegation does not need that model setup.

All tools run through DSH's managed subprocess service and resolved per-session file sandbox. A wider `sandbox_permissions` paired with a `justification` uses the host approval channel; unavailable/rejected approval fails closed. Cancellation, timeout and plugin unload terminate and join the owned subprocess range. Native OCR is invoked directly, so its npm launcher's background update checks are not started. This is a **local execution** plugin, not a remote-container binary deployment mechanism.

## Update and remove

See the [upgrade and compatibility guide (中文)](https://github.com/mocilukalbj/dsh-open-code-review/blob/main/UPGRADE.zh.md) for OCR updates,
DSH API migrations, integration alternatives, release checks and rollback.

dsh-market can manage the bundle after catalog acceptance. Its updates update this adapter and its pinned OCR dependency together; a separately installed global OCR is not updated by this plugin. Before listing, install a newer release tarball with `dsh plugin --profile web add <tarball>`.

```sh
dsh plugin --profile web remove dsh-open-code-review
```

Disabling/unloading unregisters the tools and skill. Removal does not delete a user's existing OCR config or review history.

## Develop and verify

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:integration
npm pack --ignore-scripts
```

Integration tests load actual DSH services and this bundle through Cordis Loader, then execute the packaged OCR binary in a temporary Git repository under the real DSH sandbox. They require a working platform sandbox; an unavailable runner fails the test instead of silently bypassing confinement. No model credentials are needed. Model review quality and live API providers are outside these deterministic tests.

The package ships JavaScript directly, so GitHub/source installs do not require a `prepare` build. Native OCR comes from Alibaba's platform packages; production installs should keep optional dependencies and can block lifecycle scripts.

## Attribution

Apache-2.0. See [NOTICE](NOTICE). Review workflow adapted from Alibaba's Open Code Review delegation skill; the OCR implementation is consumed from its original npm package. See [upstream delegation documentation](https://github.com/alibaba/open-code-review/blob/main/pages/src/content/docs/en/integrations/delegate.md) and [DSH bundle documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md).
