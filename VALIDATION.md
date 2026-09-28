# Validation — 0.1.0

Validated locally on 2026-09-28, Linux x64, Node.js 22.23.1, npm 10.9.8,
pnpm 11.7.0, Git 2.55.0, DeepSeek Harness 0.1.7-rc.2, OCR 1.12.10.

## Passed

- GitHub Actions passed all check, unit, integration and packing steps on
  `ubuntu-latest`, `macos-latest`, and `windows-latest`:
  https://github.com/mocilukalbj/dsh-open-code-review/actions/runs/36435343884
  (runtime/test revision `24bd96213ca9dbc7f50748a88354a5466b96754e`).
- `npm run check`: syntax, bundle manifest, shipped files, pinned OCR dependency.
- `npm test`: 14 tests covering literal argv, scope validation, session workspace,
  JSON validation, sandbox/approval failures, truncated output, nonzero exit,
  cancellation, timeout and credential-shaped diagnostic redaction.
- `npm run test:integration`: 3 tests using real Cordis Loader and DSH sandbox /
  subprocess services. Real OCR exercised workspace/range/commit selection and
  custom rules. Tool/skill unloading and termination of an active sandboxed
  subprocess passed. Optional full-review tool registration was checked.
- `npm pack --ignore-scripts`: 10 production files; no source build needed.
- Real `dsh plugin --profile ocr-smoke add <tarball> --ignore-scripts` installed
  the production archive into an isolated `DSH_HOME`. The profile activated the
  bundle, started successfully, advertised the skill, and executed both tools
  under a read-only sandbox against a Git fixture, including an unborn branch.
  Result: `ocr_preview`, `ocr_rules`, skill `open-code-review`, workspace file
  `src/new.js`, one rule group.
- Real `dsh plugin --profile ocr-smoke remove dsh-open-code-review` completed.
  The existing user profile was not used for these checks.
- Market entry template passed the upstream catalog's `validateEntries`
  structural validator after substituting a proposed owner and filename.
  Validator source: awesome-dsh-plugin commit
  `4fee2fcc011f8e2d68e35695d6b411c82c7c9a12`.

Production archive: `dsh-open-code-review-0.1.0.tgz` (also released as
`dsh-open-code-review.tgz`). Publication metadata and README install URLs were
updated after the runtime tests; the runtime code and dependency versions are unchanged.

SHA-256: `a2650419ac5951943caa4756a080ca0ff087e0516c4f20c0ee463a2e9185ce37`

## Limits

- Cross-platform results are from hosted CI; the full DSH CLI installation and
  removal smoke test was run locally on Linux.
- No live LLM request was made. Optional OCR-managed API connectivity, review
  quality and model-specific behavior have not been validated.
- Rule configuration comes from the current checkout, even when reviewing a
  historical commit; this is verified upstream behavior, documented in the skill.
- GitHub Release publication and market acceptance are separate from local
  validation. The concrete market entry targets this project; catalog acceptance
  remains a maintainer decision. No npm publication is required for Release installs.
- Current catalog rules require a public repository at least one day old and a
  maintainer's review; structural validation alone does not establish eligibility.

References: [catalog requirements](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md),
[DSH publishing](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md).
