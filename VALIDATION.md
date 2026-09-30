# Validation — 0.1.1

Compatibility update on 2026-09-30 for DeepSeek Harness **0.2.0-rc.2**,
with **0.1.7-rc.2** retained as an explicitly supported host. OCR stays pinned
at **1.12.10**; the execution implementation and skill are unchanged.

## Compatibility findings

- The running local web profile and CLI both use 0.2.0-rc.2. The original
  0.1.0 bundle was installed but disabled with `incompatible-version` because
  five DSH service peers accepted only 0.1.7-rc.2.
- The shipped `lib` trees of tools, skill, subprocess, sandbox and sandbox-policy
  are byte-for-byte identical between these two kernels. Cordis 4.0.4 and
  Schemastery 3.18.4 are also unchanged. Native bundle + tools + skill remains
  the supported integration; no version exemption or sandbox bypass is needed.
- Calling the new host's `evaluatePluginCompatibility` rejects the old peers
  and accepts `0.1.7-rc.2 || 0.2.0-rc.2`. The manifest now uses that explicit
  range for DSH peers and engines. Development dependencies and the lockfile
  use 0.2.0-rc.2.

## Verification

- Local Linux x64, Node 22.23.1: syntax/package checks, all 14 unit tests and
  all 3 real-service integration tests passed using 0.2.0-rc.2 services.
  These include real native OCR workspace/range/commit/rules calls, read-only
  sandboxing, optional tool registration, and cancellation/join on unload.
- All six GitHub Actions jobs passed: both declared DSH versions on Linux,
  macOS and Windows, including checks, all 17 tests and packing:
  https://github.com/mocilukalbj/dsh-open-code-review/actions/runs/36688037567
  (revision `7cde8ec3bb9d3fb6dd2e7bf1eff368d7d9df8b6a`).
  Integration tests assert the actual installed host-service versions.
- The production tarball installed through the real 0.2.0-rc.2 CLI in an
  isolated `DSH_HOME`. A full base-profile startup registered both tools and
  the callable skill. Actual native OCR preview/rules calls passed under the
  read-only sandbox; unloading removed both tools and the skill.
- An independent local 0.1.7-rc.2 test checkout also passed checks and all
  17 tests, including the actual read-only sandbox and active-process unload.
- After publication, the versioned GitHub asset was downloaded and its hash
  matched. The actual local web profile was upgraded to 0.1.1 and enabled via
  DSH's plugin manager. The running 0.2.0-rc.2 host reported installed/enabled,
  no error, and an active plugin fiber. Other plugin specs and bundle selections
  were preserved; the service applied the change live without restart.
- CLI removal from the isolated profile succeeded and removed the dependency,
  package entry and composed bundle rows.
- Production archive SHA-256:
  `7a1d1b152421e46c41de1fbc08801336e99e785814c7b96a8259f4e269f793d3`.
  This is the exact archive used in the full CLI smoke test.

## npm distribution and update source — 2026-09-30

- `dsh-open-code-review@0.1.1` is published to the public npm registry; `latest`
  points to 0.1.1. The npm archive matches the tested GitHub Release archive
  byte-for-byte, including its SHA-512 integrity and SHA-256 recorded above.
- The original failing `npm view dsh-open-code-review versions dist-tags`
  query now succeeds and returns version/latest 0.1.1.
- The actual web profile was migrated from the pinned Release URL to npm
  spec `0.1.1` using the DSH CLI with `--save-exact --ignore-scripts`.
  Other plugin specs and bundle selections were preserved. The running host
  reports installed/enabled, no error, and an active plugin fiber.
- dsh-market's read-only update API reports source `npm`, installed/latest
  version 0.1.1 and `updateAvailable: false`, correctly indicating that the
  installed version is current.
- A clean isolated 0.2.0-rc.2 profile installed from the npm package name with
  `--ignore-scripts`. Full Host startup, actual OCR preview/rules calls, skill
  registration, runtime unloading and CLI removal passed.
- Without `--ignore-scripts`, pnpm 11 rejects the upstream OCR wrapper's
  unapproved postinstall script in a clean profile. The plugin invokes the
  native binary supplied by optional dependencies directly, so these checks
  skip install scripts and keep optional dependencies enabled. No global
  build approval or release-age policy was disabled.

The prior 0.1.0 evidence below remains a historical baseline. Live LLM requests,
model review quality, other DSH versions and remote execution are outside this
compatibility check.

---

## Historical validation — 0.1.0

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
