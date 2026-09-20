#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain JS, no annotations */
// Build the PIXL engine's Node binding for this Linux machine and drop it
// where `@xuckless/pixl-engine` looks for it, so the app can be developed,
// packaged and tested here without a GitHub Actions run.
//
// Why this exists: the published `@xuckless/pixl-engine` carries macOS and
// Windows platform packages only. Its generated loader (index.js) first tries
// `./pixl-engine.linux-<arch>-gnu.node` beside itself, then the platform
// package. We satisfy the first lookup by compiling the binding from the
// sibling engine checkout and copying the .node into the installed package.
// Nothing in package.json or the lockfile changes, so the macOS and Windows
// builds are untouched.
//
//   pnpm engine:linux              build in the pixl-dev container, then install
//   pnpm engine:linux -- --host    build with the host's cargo instead
//   pnpm engine:linux -- --no-build   install an already built .node
//   pnpm engine:linux -- --check   exit 1 unless the .node is installed
//
// The engine checkout defaults to ../pixl-engine; override with
// PIXL_ENGINE_DIR or --engine <dir>. The container image is built from the
// engine's ci/linux-dev.Containerfile on first use.
//
// The binary links libheif and libjxl dynamically from the build environment
// (Fedora 44 in the container), so the host needs the matching runtime
// packages: `libheif` and `libjxl` from Fedora, plus `libheif-freeworld` from
// RPM Fusion if HEIC decoding is wanted. `ldd` the .node to check.

import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

if (process.platform !== 'linux') {
  console.error(`engine-linux: this script is for Linux hosts (got ${process.platform})`)
  process.exit(1)
}

const ARCH = { x64: 'x64', arm64: 'arm64' }[process.arch]
if (!ARCH) {
  console.error(`engine-linux: unsupported arch ${process.arch}`)
  process.exit(1)
}
const NODE_FILE = `pixl-engine.linux-${ARCH}-gnu.node`
const IMAGE = process.env.PIXL_DEV_IMAGE ?? 'localhost/pixl-dev'
const CONTAINER_CLI = process.env.PIXL_CONTAINER_CLI ?? 'podman'

const engineDir = resolve(
  opt('engine') ?? process.env.PIXL_ENGINE_DIR ?? join(appDir, '..', 'pixl-engine')
)
const bindingDir = join(engineDir, 'bindings', 'node')
const built = join(bindingDir, NODE_FILE)

// Where the installed package really lives (pnpm symlinks into node_modules/.pnpm).
const require = createRequire(join(appDir, 'package.json'))
let installedDir
try {
  installedDir = dirname(realpathSync(require.resolve('@xuckless/pixl-engine/package.json')))
} catch {
  console.error('engine-linux: @xuckless/pixl-engine is not installed; run `pnpm install` first')
  process.exit(1)
}
const installed = join(installedDir, NODE_FILE)

if (flag('check')) {
  if (existsSync(installed)) {
    console.log(`engine-linux: ${NODE_FILE} is installed (${installed})`)
    process.exit(0)
  }
  console.error(`engine-linux: ${NODE_FILE} is not installed; run \`pnpm engine:linux\` first`)
  process.exit(1)
}

function run(cmd, args, options = {}) {
  console.log(`$ ${[cmd, ...args].join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...options })
  if (r.error) throw r.error
  if (r.status !== 0) {
    console.error(`engine-linux: ${cmd} exited with ${r.status}`)
    process.exit(r.status ?? 1)
  }
}

function build() {
  if (!existsSync(join(bindingDir, 'package.json'))) {
    console.error(
      `engine-linux: no Node binding at ${bindingDir}; set PIXL_ENGINE_DIR to the pixl-engine checkout`
    )
    process.exit(1)
  }
  // `npm ci` only when the binding's dev dependencies are missing; it is the
  // slow part and the lockfile pins them.
  const needsInstall = !existsSync(join(bindingDir, 'node_modules', '.bin', 'napi'))
  const steps = [...(needsInstall ? ['npm ci'] : []), 'npm run build'].join(' && ')

  if (flag('host')) {
    run('sh', ['-c', steps], { cwd: bindingDir })
    return
  }

  const hasImage =
    spawnSync(CONTAINER_CLI, ['image', 'exists', IMAGE], { stdio: 'ignore' }).status === 0
  if (!hasImage) {
    run(CONTAINER_CLI, [
      'build',
      '-t',
      IMAGE,
      '-f',
      join(engineDir, 'ci', 'linux-dev.Containerfile'),
      join(engineDir, 'ci')
    ])
  }
  // Same invocation the engine's Containerfile documents: the checkout is
  // mounted at /work (relabelled for SELinux) and the crate registry is a
  // named volume so rebuilds do not re-download. Rootless podman maps the
  // container's root to the host user, so the outputs are ours.
  run(CONTAINER_CLI, [
    'run',
    '--rm',
    '-v',
    `${engineDir}:/work:Z`,
    '-v',
    'pixl-cargo:/usr/local/cargo/registry',
    '-w',
    '/work/bindings/node',
    IMAGE,
    'sh',
    '-c',
    steps
  ])
}

if (!flag('no-build')) build()

if (!existsSync(built)) {
  console.error(`engine-linux: expected ${built} after the build`)
  process.exit(1)
}

// A binding compiled from a different engine version than the one installed
// would still load, but its JS glue (index.js/lib.js) and API may disagree.
const srcVersion = JSON.parse(readFileSync(join(bindingDir, 'package.json'), 'utf8')).version
const dstVersion = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8')).version
if (srcVersion !== dstVersion) {
  console.warn(
    `engine-linux: warning: built from pixl-engine ${srcVersion}, but ${dstVersion} is installed`
  )
}

copyFileSync(built, installed)
console.log(
  `engine-linux: installed ${NODE_FILE} (${(statSync(installed).size / 1e6).toFixed(1)} MB) → ${installed}`
)

// Show what it links against; a missing library here means a missing runtime
// package on this machine, not a build problem.
try {
  const ldd = execFileSync('ldd', [installed], { encoding: 'utf8' })
  const missing = ldd.split('\n').filter((l) => l.includes('not found'))
  const libs = ldd
    .split('\n')
    .map((l) => l.trim().split(' ')[0])
    .filter((l) => /^lib(heif|jxl|de265|aom|x265|jpeg|webp|png|lcms)/.test(basename(l)))
  console.log(`engine-linux: links ${libs.join(', ') || '(no image libraries dynamically)'}`)
  if (missing.length) {
    console.error(`engine-linux: unresolved shared libraries:\n${missing.join('\n')}`)
    process.exit(1)
  }
} catch {
  // ldd absent: nothing to report.
}

// Prove it loads in this Node before the app tries. Electron shares the
// Node-API ABI, so a binding that loads here loads in the utility process.
const version = execFileSync(
  process.execPath,
  ['-e', "console.log(require('@xuckless/pixl-engine').engineVersion())"],
  { cwd: appDir, encoding: 'utf8' }
).trim()
console.log(`engine-linux: @xuckless/pixl-engine reports engine ${version}`)
