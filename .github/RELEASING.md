# Releasing Space Pixl

Maintainer notes. The public README no longer carries these.

## Develop

```sh
pnpm config set //npm.pkg.github.com/:_authToken <PAT with read:packages>   # @xuckless/pixl-engine on GitHub Packages
pnpm install
pnpm dev                                   # electron-vite dev with HMR
pnpm typecheck && pnpm lint && pnpm test   # tests: node --test over the pure modules
pnpm build:unpack                          # unpacked app in dist/
```

`SPACE_PIXL_ENGINE` picks the engine: `native` (default when packaged), `auto` (default in
`pnpm dev`: native if the binding loads, else the placeholder in `src/main/engine/mock.ts`),
or `mock`. The published binding ships macOS and Windows binaries only; on Linux, build one
with the helper outside this repo (`node ../tools/engine-linux.mjs`) and the app runs the
real engine. `SPACE_PIXL_FORCE_UPDATER=1 pnpm dev` exercises the updater against the feed
in `dev-app-update.yml`.

If `pnpm dev` fails with `Error: Electron uninstall`, fetch the binary with
`node node_modules/electron/install.js`.

## Release flow

1. Commit to `main` with conventional commits. `feat` bumps minor, `fix` bumps patch
   while pre-1.0; `docs`/`chore` bump nothing.
2. `release-please.yml` keeps a release PR open with the next version and CHANGELOG. The
   version is also stamped into the download links in `README.md`, `docs/index.html` and
   `docs/site.js` through `extra-files` and `x-release-please-version` line annotations
   (one version per annotated line: the updater rewrites only the first match on a line).
3. Merging that PR tags `vX.Y.Z`, creates the GitHub release, and `release.yml` builds
   macOS arm64, macOS x64 and Windows x64 on GitHub-hosted runners, signs and notarizes
   macOS when the secrets exist, and attaches installers plus `latest*.yml` manifests.
4. Installed apps check the release feed on launch and every 4 hours.

**Channels.** Derived from the version: `0.3.0` → `latest`, `0.3.0-beta.1` → `beta`.

**Engine updates.** The engine's release workflow sends `repository_dispatch`
(`pixl-engine-released`); `bump-engine.yml` opens a `fix(engine): bump pixl-engine to X` PR.

**Manual build.** _Actions → Release → Run workflow_ with a tag; `EP_GH_IGNORE_TIME` lets
electron-builder upload to an older published release.

**CI.** `ci.yml` runs typecheck, lint, tests and a build on pushes to `main` and on PRs from
this repository. Forks and Dependabot PRs cannot install the private engine package, so their
checks fail; the `main` ruleset requires the "Typecheck, lint, build" check, so the workflow
must stay (or the ruleset must drop the check first).

## Secrets

| Name                                                         | Purpose                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `PACKAGES_TOKEN`                                             | classic PAT with `read:packages` for `@xuckless/pixl-engine` |
| `RELEASE_PLEASE_TOKEN`                                       | PAT with `repo` + `workflow` so release PRs get workflows    |
| `CSC_LINK` / `CSC_KEY_PASSWORD`                              | base64 Developer ID Application `.p12` and its password      |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | notarization                                                 |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`                      | Windows code-signing `.pfx` (optional)                       |

Until the Apple secrets exist, macOS builds are unsigned: Gatekeeper reports them as
"damaged" (users clear quarantine with `xattr`) and Squirrel.Mac refuses auto-updates.
Windows works unsigned with a SmartScreen warning.

## GitHub Pages

`docs/` is served from `main` at https://xuckless.github.io/space-pixl/. No build step; the
site fetches the latest release from the GitHub API with the stamped version as fallback.
Screenshots in `docs/screenshots/` were captured from the built app over the Chrome DevTools
Protocol at 1240×860 @2x with the native engine.
