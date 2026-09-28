# DSH Open Code Review 0.1.0

Connect Alibaba Open Code Review to DeepSeek Harness through a native plugin bundle.

- Use `/open-code-review` to review workspace changes, a branch range, or one commit.
- Default tools `ocr_preview` and `ocr_rules` use OCR to select files and resolve
  rules, then the current DSH model reviews the code. No extra OCR API key.
- Optional `ocr_review` / `ocr_llm_test` use OCR's separately configured model.
- Pinned official OCR 1.12.10 native dependency, installed through the package
  manager without a plugin build script or runtime update/download command.
- Uses the session workspace, host sandbox/approval and managed subprocesses;
  cancellation, timeouts and unload terminate the active subprocess range.

All 14 unit tests and 3 real-service integration tests passed on Linux, macOS,
and Windows in [GitHub Actions](https://github.com/mocilukalbj/dsh-open-code-review/actions/runs/36435343884).
Production archive installation, actual tool calls and removal also passed locally
on Linux x64 with DSH 0.1.7-rc.2 and Node.js 22.23.1. Live LLM provider behavior has
not been tested. DSH 0.2 is not currently supported.

Install the attached package into your actual profile:

```sh
dsh plugin --profile web add /path/to/dsh-open-code-review.tgz
```

Reload/restart as prompted, then invoke `/open-code-review` in a conversation.
The tarball requires the package manager to download its pinned native dependency.

This is a community adapter, not an official Alibaba or DeepSeek plugin. Market
listing is subject to catalog review; publication alone does not establish listing.
