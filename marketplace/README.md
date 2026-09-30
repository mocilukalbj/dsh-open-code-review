# dsh-market submission

The storefront is https://github.com/dsh-market/dsh-market. Its curated catalog is
https://github.com/awesome-dsh-plugin/awesome-dsh-plugin. Submit entries to the
**catalog**, not to the storefront. Current rules are in the catalog's `contributing.md`.

Published project: https://github.com/mocilukalbj/dsh-open-code-review

The concrete entry is `mocilukalbj__dsh-open-code-review.yml`; `entry.template.yml`
is retained as a template for other owners. The release asset is named
`dsh-open-code-review.tgz` so its latest-download URL stays stable.
Version `0.1.1` is published to both npm as `dsh-open-code-review` and GitHub
Release using the same verified package. Install the npm source with
`dsh plugin --profile web add dsh-open-code-review@0.1.1 --save-exact --ignore-scripts`;
the catalog's `tarball` remains a fallback.

Submission procedure:

1. Publish this real, working project to a public repository. Replace `OWNER` in the
   entry template with the actual owner, and add `repository`, `homepage` and `bugs`
   metadata to package.json. Add the GitHub topic `dsh-plugin`.
2. Run check, unit and integration tests. Publish the same tested
   `npm pack --ignore-scripts` tarball to npm and GitHub Release. This project
   ships JS; source installs do not need a prepare build. Keep OCR's optional
   native package enabled while skipping its upstream postinstall script.
3. The repository must be at least one day old to pass the catalog's age gate.
   If a PR is submitted earlier, its age check remains pending/failing until that
   threshold. The catalog's current `regate.yml` periodically rechecks such PRs;
   do not create a replacement PR just to clear the age condition.
4. Submit **one file**: `data/plugins/OWNER__dsh-open-code-review.yml`, based on the
   template here. Do not hand-edit the catalog's generated READMEs.
5. Explain the difference from the existing `jiayan-xu/dsh-ocr-review`: default host-model
   delegation, bundled native OCR dependency, session workspace selection, native skill,
   host sandbox/approval handling, and cancellation/unload cleanup. Acceptance is the
   catalog maintainers' decision; it is not automatic after passing CI.

The release asset should have a stable filename (e.g. `dsh-open-code-review.tgz`) if
using a `releases/latest/download/` URL. The template assumes that file is uploaded;
otherwise remove `tarball` and use a verified npm/source distribution.

The catalog discovers a matching npm package from verified repository metadata.
Do not add an `npm:` key to the submitted YAML: the catalog currently rejects
handwritten npm mappings. An existing profile installed from the Release tarball
does not switch source merely because the same version appears on npm; install
the matching npm version by name once, then future market updates can follow npm.

Suggested PR title: `Add DSH Open Code Review with host-model delegation`

Suggested PR body: `Adds a native DSH bundle for Alibaba Open Code Review. Default
mode provides OCR file selection and rule resolution to the current host model;
optional full mode invokes OCR's configured model. The package includes a callable
skill, pins its upstream OCR dependency, and uses DSH sandbox and process lifecycle
services. Validation: npm run check, npm test, npm run test:integration, clean-profile
tarball install and uninstall. Unlike the existing OCR wrapper, it supports host-model
delegation and does not depend on WorkBuddy/Windows paths.`

Only retain validation claims that passed for the actual published revision.
