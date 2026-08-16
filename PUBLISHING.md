# Publishing

## Pre-merge checklist

1. `node bin\vskills.js init` — on a real Windows box with Developer Mode disabled and no elevated shell, run the CLI, confirm the links resolve under `%USERPROFILE%\.claude\skills`, and confirm `dir` reports them as `<JUNCTION>`.
2. `npm publish` — publish the package before merging the pull request.
3. `npm view vskills version` and `npx vskills@<version> list` — from a clean directory, verify the published version and that the CLI works. Merging before publishing leaves the documented `npx vskills init` command failing with E404 for every reader.
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

Bump the version in `package.json` before every publish. Do not add a `files` field: it would silently drop skills from the tarball.
