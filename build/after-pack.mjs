/**
 * electron-builder `afterPack` hook.
 *
 * The engine binding is architecture-specific and only ever comes from the
 * machine that ran `pnpm install`: pnpm installs the one optional platform
 * package matching its own host, and electron-builder bundles that one. So a
 * job that packages an arch other than its own produces an app whose Electron
 * binary and whose `.node` disagree — v0.1.4 shipped an arm64 macOS app
 * carrying the x86_64 binding, and the app reported the engine as unavailable
 * with napi's "Cannot find native binding" text.
 *
 * `mac.target` no longer pins an `arch` list, so the CLI flag decides and each
 * job packages only its own arch. This hook is the guard on that: it runs once
 * per packaged app, after the files are in place and before anything is
 * signed, zipped or uploaded, and throws if the binding does not match.
 */
import { readdirSync, readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs'
import path from 'node:path'

// builder-util's `Arch` enum, which the hook context passes as a number. Not
// imported: pnpm does not hoist electron-builder's own dependencies, so
// `builder-util` is not resolvable from the project root.
const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

// The platform package that must be bundled for each target we ship. Linux is
// absent on purpose: the engine publishes no Linux package, and a locally
// built `.node` is dropped inside the base package instead.
const EXPECTED_BINDING = {
  'darwin-arm64': 'pixl-engine-darwin-arm64',
  'darwin-x64': 'pixl-engine-darwin-x64',
  'win32-x64': 'pixl-engine-win32-x64-msvc'
}

const MACHO_CPU_TYPE = { x64: 0x01000007, arm64: 0x0100000c }
const PE_MACHINE = { x64: 0x8664 }

/** The Mach-O or PE architecture `file` holds, as one of ARCH_NAMES. */
function binaryArch(file) {
  const fd = openSync(file, 'r')
  const head = Buffer.alloc(64)
  try {
    readSync(fd, head, 0, head.length, 0)
  } finally {
    closeSync(fd)
  }

  // Mach-O 64-bit, little-endian host (every arch we build for).
  if (head.readUInt32LE(0) === 0xfeedfacf) {
    const cpu = head.readUInt32LE(4)
    const match = Object.entries(MACHO_CPU_TYPE).find(([, type]) => type === cpu)
    return match ? match[0] : `Mach-O cputype 0x${cpu.toString(16)}`
  }
  // Universal binary: carries every arch it lists, so it always matches.
  if (head.readUInt32BE(0) === 0xcafebabe) return 'universal'

  // PE32+.
  if (head.readUInt16LE(0) === 0x5a4d) {
    const peOffset = head.readUInt32LE(0x3c)
    const pe = Buffer.alloc(6)
    const fd2 = openSync(file, 'r')
    try {
      readSync(fd2, pe, 0, pe.length, peOffset)
    } finally {
      closeSync(fd2)
    }
    if (pe.readUInt32LE(0) !== 0x00004550) return 'unknown (bad PE signature)'
    const machine = pe.readUInt16LE(4)
    const match = Object.entries(PE_MACHINE).find(([, m]) => m === machine)
    return match ? match[0] : `PE machine 0x${machine.toString(16)}`
  }

  return 'unknown (unrecognised object file)'
}

export default async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const arch = ARCH_NAMES[context.arch] ?? String(context.arch)
  const target = `${electronPlatformName}-${arch}`
  const expected = EXPECTED_BINDING[target]

  if (expected === undefined) {
    console.log(`  • engine binding check skipped  target=${target} (no published binding)`)
    return
  }

  // Native addons are unpacked out of the asar (see `asarUnpack`), so this is
  // where the binding actually sits in the packaged app.
  const scopeDir = path.join(
    packager.getResourcesDir(appOutDir),
    'app.asar.unpacked',
    'node_modules',
    '@xuckless'
  )
  if (!existsSync(scopeDir)) {
    throw new Error(
      `engine binding check failed for ${target}: ${scopeDir} is missing, so the app ships no engine at all`
    )
  }

  const bundled = readdirSync(scopeDir).filter((name) => name.startsWith('pixl-engine-'))
  if (bundled.length !== 1 || bundled[0] !== expected) {
    throw new Error(
      `engine binding check failed for ${target}: expected exactly one platform package, ${expected}, ` +
        `but the app bundles ${bundled.length === 0 ? 'none' : bundled.join(', ')}. ` +
        `The binding comes from whichever host ran the install, so package only this job's own arch.`
    )
  }

  const bindingDir = path.join(scopeDir, expected)
  const addons = readdirSync(bindingDir).filter((name) => name.endsWith('.node'))
  if (addons.length !== 1) {
    throw new Error(
      `engine binding check failed for ${target}: ${expected} holds ${addons.length} .node files, expected 1`
    )
  }

  const addon = path.join(bindingDir, addons[0])
  const actualArch = binaryArch(addon)
  if (actualArch !== arch && actualArch !== 'universal') {
    throw new Error(
      `engine binding check failed for ${target}: ${addons[0]} is ${actualArch}, not ${arch}`
    )
  }

  const version = JSON.parse(readFileSync(path.join(bindingDir, 'package.json'), 'utf8')).version
  console.log(
    `  • engine binding ok  target=${target} package=${expected}@${version} addon=${addons[0]}`
  )
}
