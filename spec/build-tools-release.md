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

Push, PR, and ordinary manual runs do not create Drafts. Only manual `create_draft=true`
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

Publication is outside the current preparation scope. Keep the release marked as a prerelease.
