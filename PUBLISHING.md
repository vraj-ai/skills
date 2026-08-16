# Publishing

## Pre-merge checklist

1. Check out the revision under test before running the smoke test: `git clone -b docs/readme-production-standards https://github.com/vraj-ai/skills.git` (or fetch the PR head). This matters because `main` does not contain the junction fix until this PR merges. Then, on a real Windows box with Developer Mode disabled and no elevated shell, run `node bin\vskills.js init`, confirm the links resolve under `%USERPROFILE%\.claude\skills`, and in PowerShell confirm `(Get-Item "$env:USERPROFILE\.claude\skills\<name>").LinkType` returns `Junction`. In cmd.exe, `dir` reports them as `<JUNCTION>`. **Warning:** this writes to the tester's real profile directories, including copying skills into `~/.agents/skills` and creating junctions under `%USERPROFILE%\.claude\skills`; there is no flag or environment override to redirect the install. Use a throwaway Windows VM or a fresh user profile.
2. For this first publish, ship the current unpublished `package.json` version (`0.2.0`) as-is; do not bump it. Follow the publish procedure below before merging, including the clean-tree check, `npm login`/`npm whoami`, `npm pack --dry-run`, and the 2FA `--otp=<code>` note.
3. `npm view vskills version` verifies the published version; from a clean directory, `npx vskills@<version> list` exercises the published contents and verifies that the CLI works. Merging before publishing leaves the documented `npx vskills init` command failing with E404 for every reader.
4. Merge the pull request only after the preceding checks pass.

Publish only from a clean working tree on the intended branch (`git status --short`, `git branch --show-current`). Because there is no `files` field or `.npmignore`, `.gitignore` governs the tarball; uncommitted or wrong-branch content would be published under a version that can never be reused. `npm view vskills version` verifies the version, not the contents.

```sh
npm login
npm whoami
npm pack --dry-run
npm publish
npm view vskills version
```

If npm 2FA is set to “Authorization and writes”, publish with `npm publish --otp=<code>`.

For subsequent publishes, bump the version in `package.json` first. For this first
publish, leave the current unpublished `0.2.0` unchanged. Do not add a `files`
field: it would silently drop skills from the tarball.
