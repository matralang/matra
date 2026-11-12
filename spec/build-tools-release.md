# Build tools prerelease procedure

[English](./build-tools-release.md) | [日本語](./build-tools-release.ja.md)

## Versioning and publication boundary

The initial candidate is `0.3.1-alpha.1`. The [CLI package](../packages/cli/package.json)
version is authoritative for the folder, ZIP, and `matra --version`.
Core/HTML remain `0.3.0`; compiler ABI is unchanged.
`versions.json` records individual package versions, compiler manifest, Node.js version/hash,
source commit, dirty state, and lockfile hash.

Use `build-tools-v0.3.1-alpha.1`, distinct from language tag `v0.3.0`.
No npm publishing is involved. Draft creation and public publication are separate.
These are maintainer instructions; adding this document creates no tags, Drafts, or releases.

## 1. Freeze a candidate

Commit/push changes, complete review, and verify both normal CI workflows for the candidate:
six distribution targets and six portable configurations.
Check the CLI version and [release notes](../packages/cli/distribution/RELEASE-NOTES.md).
Do not reuse versions; if fixes change the distribution, assign a new candidate version.

After approval, create an annotated tag pointing to the explicit candidate commit:

```sh
git tag -a build-tools-v0.3.1-alpha.1 APPROVED_FULL_COMMIT_SHA -m "Matra build tools 0.3.1-alpha.1"
git push origin refs/tags/build-tools-v0.3.1-alpha.1
```

Never move or overwrite tags. GitHub may not allow workflow_dispatch until the workflow
exists on the default branch. Land the workflow there first, or wait until dispatch is available.

## 2. Prepare a Draft using manual CI

```sh
gh workflow run distribution.yml \
  --ref build-tools-v0.3.1-alpha.1 \
  -f create_draft=true
```

Push, PR, and ordinary manual runs do not create Drafts.
Normal CI also aggregates all six ZIPs on Linux to check extraction compatibility,
checksums, provenance, and matching compilers. Windows ZIP entry names use `/` separators,
so other platforms can extract them without warnings.
The lockfile and Core parser input/output are checked out with LF to prevent Windows
line-ending conversion from changing checksums or marking regenerated parser source dirty.
Core TypeScript output also uses LF explicitly so Windows defaults do not modify tracked build output.
Tracked generated JavaScript and declarations are checked out with LF as well, keeping Git
line-ending attributes consistent before and after regeneration.
Only manual `create_draft=true`
creates one after all these checks:

1. An existing tag resolves to the checked-out HEAD; source is clean.
2. All six native CI targets pass init/build/dev and ZIP re-extraction checks.
3. Exactly twelve files (six ZIPs and six checksums) are downloaded from this run.
4. ZIP hashes, distribution version, target, source commit, dirty=false, lockfile hash,
   Node.js pins, package versions, compiler manifest, and Wasm hash match.
5. A Draft is created with bilingual notes and `--draft --prerelease --latest=false --verify-tag`.

Only the Draft job has `contents: write`; normal builds use read permissions.
Existing releases are not overwritten. Check run logs and the actual Draft state after failures.
An asset-upload failure may leave a partial Draft. Do not automatically delete or publish it;
obtain approval to clean it up before retrying.

## 3. Pre-publication checks

- Check the Draft tag, commit, version, six ZIPs, and six checksums.
- Review licenses, bilingual instructions, limitations, and unsigned/not-notarized notices.
- Download ZIPs from the actual Draft and verify their checksums.
- Try extraction, PATH setup, init/build/dev on actual macOS and Windows systems.
- Check Windows Ctrl+C and macOS download approval interactively.
- Confirm Linux requires glibc (Alpine/musl is excluded).

CI does not guarantee Gatekeeper behavior, Windows interactive operations, or every environment.
Stop publication on failure and create a new candidate. Byte-identical ZIP reproducibility
is not guaranteed.

## 4. Publish only after separate approval

Share Draft contents and manual test results, then obtain explicit publication approval:

```sh
gh release edit build-tools-v0.3.1-alpha.1 --draft=false --prerelease --latest=false
```

Keep the release marked as a prerelease, never latest/stable.

## Initial experimental publication

Publication of the six existing `0.3.1-alpha.1` ZIPs for interested developers was explicitly approved.
Published on 2026-10-31 as a
[Pre-release](https://github.com/matralang/matra/releases/tag/build-tools-v0.3.1-alpha.1).
Source: `164b168f8e0d38501db934ff7f79141c4c04cf3b`.
All jobs in the [creation CI](https://github.com/matralang/matra/actions/runs/41039927410) passed.
All twelve Draft attachments were downloaded and verified; the macOS arm64 ZIP passed runtime checks.
Document Chrome's unresolved dangerous-download block on Windows, unverified interactive Windows
operations, and macOS download approval on the release page and README. Do not assert a false positive
or safety; instruct users to stop downloading/running if warned.
This records the initial publication decision, not a blanket exception for failures in future candidates.
Only release text is updated; existing ZIPs, checksums, and the tag remain unchanged.
The bundled README predates the reported Chrome issue; read the latest release page before downloading.
No npm publication or website deployment is performed.

## npm installation release preparation

For the event, a separate installation path using Node.js 22/24 and npm is available.
CLI `0.3.2-alpha.0` and Styles `0.1.0` are published on npm as experimental packages.
The follow-up CLI `0.3.2-alpha.1` was also published on November 12, 2026 (see the publication record).
The campaign's announcement and support period are separate from the lifetime of the tools.
Dates and support scope are undecided; published packages will not be removed at the end.
Existing ZIPs and Git tags remain unchanged.

Use these commands:

```sh
npm install --global @matra/cli@0.3.2-alpha.1
matra --version
matra init hello
cd hello
matra build
matra dev
```

Choose a directory that does not exist for `hello`. Open `dist/index.html` or the displayed
localhost URL, refresh the browser manually, and stop with Ctrl+C. The same commands work
in Windows PowerShell. If the global command is not found, check npm's prefix and PATH.
If PowerShell blocks scripts, use `npm.cmd` and `matra.cmd` instead.
Builds execute document JavaScript; only use trusted documents. No OS sandbox or timeout
is guaranteed. Unlike the bundled ZIP, this path requires Node.js.

Before publication, fix a clean candidate commit and check the specified Core, HTML, and
site-generation versions against the actual npm packages and their integrity. Pack CLI,
Core, and site-generation, and fetch unchanged Command `0.1.0` and Styles `0.1.0` tarballs from the registry.
Use the
[dedicated CI](../.github/workflows/npm-cli.yml) on Windows/macOS and Node.js 22/24 to
check npm global installation into an isolated prefix, `--version`, init, build, dev,
component rendering, and output preservation on failure.
The test installs local candidate Core/site-generation and published Command/Styles tarballs alongside CLI;
it does not prove that CLI alone can be installed from the registry. Check PATH, browser
display, and Ctrl+C on actual devices as well. Reverify after any candidate changes.

Publish only after separate approval. Check version availability and npm permissions;
publish Core before its dependent Command and site-generation packages, then publish CLI,
using the `preview` tag. Styles `0.1.0` is already published. After publication, install
CLI alone from the registry in a clean environment and recheck init/build/dev and integrity.
If this fails, do not deploy the website; investigate and prepare a new version if needed.
Remove the website's preparation notice only after registry verification and deployment approval.

```sh
pnpm --filter @matra/core publish --tag preview --access public
pnpm --filter @matra/command publish --tag preview --access public
pnpm --filter @matra/site-generation publish --tag preview --access public
pnpm --filter @matra/cli publish --tag preview --access public
npm view @matra/core@0.3.1-site.1 dist.integrity
npm view @matra/command@0.1.0 dist.integrity dependencies
npm view @matra/site-generation@0.1.0-site.3 dist.integrity dependencies
npm view @matra/styles@0.1.0 dist.integrity
npm view @matra/cli@0.3.2-alpha.1 dist.integrity dependencies
```

### Publication record: November 7, 2026

Following approval, Styles `0.1.0` and then CLI `0.3.2-alpha.0` were published from
source commit `e378ed600a267b75cf70cafd08b7bf31246f2212`. Publishing from the
dedicated branch used `--no-git-checks` after verifying a clean checkout and matching remote commit.
All four [npm CLI CI](https://github.com/matralang/matra/actions/runs/42368119700) configurations,
and all six configurations of [ZIP CI](https://github.com/matralang/matra/actions/runs/42368119652)
and [portable CI](https://github.com/matralang/matra/actions/runs/42368119621), passed.
On Windows 11 x64 / Node.js 24.19.0, the user installed tarballs and confirmed init/build,
browser display, and Ctrl+C. On macOS arm64 / Node.js 24.17.0, CLI alone was installed
from the registry into an isolated prefix; init/build/dev and browser display were verified.
Both registry integrity values matched packs from the candidate commit.

- CLI integrity: `sha512-1SBVjZgfLn2ammi+8K7j3EeYnL4CNZVRiN+UAw+ZsZQCzHurca4Qj5xx0EVBBp49L1dM/dVHwQBD9xlAqpQQeQ==`
- Styles integrity: `sha512-wwaL93dZ83xir5ygumYpcD/2DHwyuS9XxJ/Y2ar4oINthOWOlyb1Y+s+dD+SZnKolHRifDfgFF7HvzoBLiHzLw==`
- Both packages have `preview` and `latest` tags. CLI `latest` changed from `0.0.0-stage`
  to experimental `0.3.2-alpha.0`; the user chose to proceed without restoring it.
- Existing ZIPs and Git tags are unchanged. Registry installation on an actual Windows machine
  has not yet been verified.

### Publication record: November 12, 2026

Following approval, Core `0.3.1-site.1`, Command `0.1.0`, site-generation `0.1.0-site.3`,
and CLI `0.3.2-alpha.1` were published from source commit
`e297c3cbfe1eacf96609da0c0e3fa46bb6ba1d41`, in dependency order. At publication, their `preview` tags pointed
to these candidates; existing `latest` tags were preserved. Styles `0.1.0` was already published.
All [npm CLI CI](https://github.com/matralang/matra/actions/runs/43127441219),
six [distribution CI](https://github.com/matralang/matra/actions/runs/43127441245) targets,
and [portable CI](https://github.com/matralang/matra/actions/runs/43127441444) passed.

- Core integrity: `sha512-FIV721ltIYt8Mwyhn6aI6C+gAIR/X81LvMxqpmH97FJ2Et7LhnmklBMfnKMiZg2NMx534E6Jicna8WiwjtZ3Zw==`
- Command integrity: `sha512-u3TR7t6fzevxw818+DuoOezqqse6kW6PmYq7QNfve5p6rc5ZqgPZ88p8axkvlLtANjiUk4n+JAjZVtSz1flfrQ==`
- site-generation integrity: `sha512-jWgjfG7i247ge8IB6juGpuM3O1b7eVh2pHSflT2rxVALNTciXjHA9S5oojdg6oMWECvfAlhBvGzeo3ZUx08TQg==`
- CLI integrity: `sha512-Eszw10KYemu0VIw4CORQzCfbURWrK0AFq9FxE2l2n5b3kDaNsKsriUkWSKCkLtolBgy4pNjNua1a1uxgNJmLOA==`
- Styles integrity: `sha512-wwaL93dZ83xir5ygumYpcD/2DHwyuS9XxJ/Y2ar4oINthOWOlyb1Y+s+dD+SZnKolHRifDfgFF7HvzoBLiHzLw==`

On macOS with Node.js 24.17.0 / npm 11.13.0, CLI alone was installed globally into a temporary
prefix from the registry. The registry tarball integrity matched, and `matra --version`, init,
build, and dev passed. Registry installation and interactive operations on a physical Windows
machine remain unverified. Only npm packages were published; no website deployment, existing ZIP,
or Git tag was changed.

### Core browser publication record

On November 12, 2026, following approval, Core `0.3.1-site.2` was published from source commit
`c483462263bf5ef7abada1bcca556d03a3f5d11c`. `preview` points to this version, while `latest`
remains `0.3.0`. No other packages, website deployment, existing ZIPs, or Git tags were changed.
[npm CLI CI](https://github.com/matralang/matra/actions/runs/43144528020),
[distribution CI](https://github.com/matralang/matra/actions/runs/43144527886), and
[portable CI](https://github.com/matralang/matra/actions/runs/43144527820) passed.

- Core integrity: `sha512-WulRgpt6STO9WgM5Sw06qzPQlUIIPvwyKSTTgsDtDORtAzruRwI8tadFaSluWBT5lkfgufrvIfXRARr1qkkl8w==`
- On macOS with Node.js 24.17.0 / npm 11.13.0, a fresh consumer installed the package from
  the registry and checked synchronous and asynchronous browser entries and a JavaScript block.
  Registry integrity matched the previously verified tarball.
- The minified, ESM-split Core-only sample measured 16,045 initial bytes, 122,139 additional
  bytes, and 138,184 bytes total. Full website and Worker sizes and browser behavior are unverified.

### Next candidate

The following npm candidates include function-style Matra components. They have not been published.

| Package | Candidate version | Related packed dependencies |
| --- | --- | --- |
| `@matra/core` | `0.3.1-site.3` | Compiler ABI remains `matra-value-1` |
| `@matra/site-generation` | `0.1.0-site.4` | Core `^0.3.1-site.3`, HTML `^0.3.1-site.0` |
| `@matra/cli` | `0.3.2-alpha.2` | Core `0.3.1-site.3`, site-generation `0.1.0-site.4` |

Command `0.1.0`, HTML `0.3.1-site.0`, and Styles `0.1.0` will not be republished.
Published Command depends on Core `^0.3.1-site.1`, which accepts the candidate Core.
Verify actual resolution using the published Command/Styles tarballs and the three candidate packages
in an isolated npm installation. These candidate versions were unused in the registry when preparation began;
recheck immediately before publication.

Define `fn Card(props, children) { ... }` in `.matra` files registered through `site.components`;
pages and layouts call `Card({ title: "Heading" }, [p { "Body" }])`.
Components expand to ordinary HTML. Shadow DOM, new grammar, and direct JavaScript page registration are excluded.
Packed installation checks cover dependency versions and Core resolution, init/build/install/dev,
components in Markdown layouts and executable pages, nesting, escaping, basePath, and preservation of old
HTML/manifests on cycle errors.

Before publication, commit and push changes, fix a clean candidate commit, and check all four updated npm CLI CI
configurations, six distribution targets, and portable CI. Local checks do not establish success on other OS/Node.js versions.
Preparation does not modify existing ZIPs, Git tags, website deployment, or npm tags.
After separate approval, publish Core, then site-generation, then CLI using `preview`, preserving `latest`.
Unlike the older command example above, do not publish Command for this candidate.
After publication, install CLI alone from the registry and verify again.

#### Local preparation verification

On macOS arm64 / Node.js 24.17.0 / npm 11.13.0, packing the three candidates,
isolated global installation with registry Command/Styles tarballs, and the smoke checks above passed.
HTML `0.3.1-site.0` also came from the registry. CLI, site-generation, and Command all resolved
Core to candidate `0.3.1-site.3`.
The 40 related tests, `pnpm run lint` (including build/type checks), and `git diff --check` passed.
The Core tarball includes the new API declarations and compiler; compiler manifest version, ABI, hash,
and Stage 2/3 equality record were checked.
Windows, Node.js 22, and remote CI remain unverified for this candidate.
Verified tarball integrities follow. Reverify after candidate changes or repacking.

- Core: `sha512-6/T6kS8NqlLZ7P5UhXmDz6zRmYENkuy85TKJaKPT9zHkqRhx6Y9pK3xycnPBTF/4KQ4f1GXvaD7G+1la7Yzc5Q==`
- site-generation: `sha512-DTFuQuiKGI048SbBq87GR5k40cJMDAQ4mFKh3I2dOxJsabooHcZqsHNPBbShlGR3oj+rhk1XVb8rkdlU/ajK/Q==`
- CLI: `sha512-quUxdEFH1M7F0NYWIxA0HCzh6BBn34miVItoBMBSkGZ4XFwLFiSn8KQ6KZr8m4om28qhb0ZvTMb3RVVpuKRRDA==`
