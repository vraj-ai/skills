# Publishing

## Pre-merge checklist

1. Check out the revision under test before running the smoke test: `git clone -b <branch> https://github.com/vraj-ai/skills.git skills` (or fetch and check out the PR head). Then `cd skills`. This matters because the revision under test may not be on `main` until it merges. On a real Windows box with Developer Mode disabled and no elevated shell, run `node bin\vskills.js init`, confirm the links resolve under `%USERPROFILE%\.claude\skills`, and in PowerShell confirm `(Get-Item "$env:USERPROFILE\.claude\skills\<name>").LinkType` returns `Junction`. In cmd.exe, `dir` reports them as `<JUNCTION>`. **Warning:** this writes to the tester's real profile directories, including copying skills into `~/.agents/skills` and creating junctions under `%USERPROFILE%\.claude\skills`; there is no flag or environment override to redirect the install. Use a throwaway Windows VM or a fresh user profile.
2. Publish the version already set in `package.json`; bump before the next publish. Follow the publish procedure below before merging, including the clean-tree check, `npm login`/`npm whoami`, `npm pack --dry-run`, and the 2FA `--otp=<code>` note.
3. On the same Windows box, after publishing, require a clean starting state before running the published package: use a fresh Windows user profile or throwaway VM snapshot, or explicitly remove `%USERPROFILE%\.agents\skills` and `%USERPROFILE%\.claude\skills` first. Without this, `init` is a no-op and the junction check passes on the earlier run's links, proving nothing about the published package. Record `npm --version` and `node --version` with the result — **the failure this release fixes only reproduces on npm 12+**, so a pass on npm 10 or 11 does not verify it, and Developer Mode must still be off with no elevated shell. Then run the command the README actually documents, unpinned, so `latest` dist-tag resolution is exercised too: `npx vskills init`. Confirm the links resolve and that `(Get-Item "$env:USERPROFILE\.claude\skills\<name>").LinkType` returns `Junction`. Finally run `npx vskills list` to exercise the published contents. This post-publish check proves the published artifact; the clone-based check above proves the revision under test. Merging before publishing leaves the documented `npx vskills init` command failing with E404 for every reader.
4. Merge the pull request only after the preceding checks pass.

Publish only from a clean working tree on the intended branch (`git status --short`, `git branch --show-current`). Because there is no `files` field or `.npmignore`, `.gitignore` governs the tarball; uncommitted or wrong-branch content would be published under a version that can never be reused. `npm view vskills version` verifies the version, not the contents.

```sh
npm login
npm whoami
npm test
npm pack --dry-run
npm publish
npm view vskills version
```

The dry-run should list one `SKILL.md` for every top-level skill directory in
the repo, and no `CONTEXT/` or `docs/` paths. Compare against the repo rather
than a fixed number — the count grows every time a skill is added:

```sh
git ls-files '*SKILL.md' | wc -l          # expected
npm pack --dry-run 2>&1 | grep -c SKILL.md # actual
```

If npm 2FA is set to “Authorization and writes”, publish with `npm publish --otp=<code>`.

Do not add a `files` field: it would silently drop skills from the tarball.
