# Publishing

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
