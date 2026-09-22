/**
 * Merges the per-arch `latest-mac.yml` files into the one feed macOS apps poll.
 *
 * Each macOS release job packages one architecture, so each writes a manifest
 * listing only its own zip and dmg, and the two jobs overwrite each other's
 * copy on the GitHub release. That single-arch feed breaks electron-updater:
 * `MacUpdater.filterFilesForArch` keeps the arm64 file on Apple Silicon and
 * drops every arm64 file on Intel, so a feed missing one arch either serves
 * Intel users nothing at all or hands Apple Silicon users the x64 zip.
 *
 * Usage: node build/merge-mac-channel.mjs <manifest...> > latest-mac.yml
 *
 * Deliberately parses only the shape electron-builder emits, and throws on
 * anything else, so a format change fails the release instead of quietly
 * publishing a feed nobody can update from.
 */
import { readFileSync } from 'node:fs'

/** The fields we carry over, in the order electron-builder writes them. */
function parseManifest(source, text) {
  const lines = text.split('\n')
  const top = new Map()
  const files = []
  let inFiles = false

  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue
    const where = `${source}:${index + 1}`

    if (line === 'files:') {
      inFiles = true
      continue
    }

    const entry = /^ {2}- url: (.+)$/.exec(line)
    if (entry !== null) {
      if (!inFiles) throw new Error(`${where}: file entry outside the files block`)
      files.push({ url: entry[1] })
      continue
    }

    const field = /^ {4}(\w+): (.+)$/.exec(line)
    if (field !== null) {
      if (files.length === 0) throw new Error(`${where}: file field before any entry`)
      files[files.length - 1][field[1]] = field[2]
      continue
    }

    const topField = /^(\w+): (.+)$/.exec(line)
    if (topField === null) throw new Error(`${where}: unrecognised line ${JSON.stringify(line)}`)
    inFiles = false
    top.set(topField[1], topField[2])
  }

  if (!top.has('version')) throw new Error(`${source}: no version`)
  for (const file of files) {
    for (const key of ['sha512', 'size']) {
      if (file[key] === undefined) throw new Error(`${source}: ${file.url} has no ${key}`)
    }
  }
  if (files.length === 0) throw new Error(`${source}: no files`)
  return { version: top.get('version'), releaseDate: top.get('releaseDate'), files }
}

const sources = process.argv.slice(2)
if (sources.length < 2) {
  throw new Error('usage: node build/merge-mac-channel.mjs <manifest> <manifest> [...]')
}

const parsed = sources.map((source) => parseManifest(source, readFileSync(source, 'utf8')))

const versions = [...new Set(parsed.map((m) => m.version))]
if (versions.length !== 1) {
  throw new Error(`manifests disagree on the version: ${versions.join(', ')}`)
}

// electron-builder lists x64 first and points the legacy `path` at it, and
// old electron-updater builds read `path` rather than `files`. Keep that
// order: x64 zips, then everything else, in the order the inputs gave them.
function rank(url) {
  const isZip = url.endsWith('.zip')
  const isArm64 = url.includes('arm64')
  if (isZip && !isArm64) return 0
  if (isZip) return 1
  return 2
}

const merged = []
const seen = new Set()
for (const file of parsed.flatMap((m) => m.files)) {
  if (seen.has(file.url)) continue
  seen.add(file.url)
  merged.push(file)
}
merged.sort((a, b) => rank(a.url) - rank(b.url))

// The invariant electron-updater needs: one zip per architecture.
const zips = merged.filter((file) => file.url.endsWith('.zip'))
const arm64Zips = zips.filter((file) => file.url.includes('arm64'))
if (arm64Zips.length === 0 || arm64Zips.length === zips.length) {
  throw new Error(
    `the merged feed covers only one architecture (${zips.map((f) => f.url).join(', ') || 'no zips'}); ` +
      'electron-updater would leave the other one unable to update'
  )
}

const releaseDate = parsed
  .map((m) => m.releaseDate)
  .filter((date) => date !== undefined)
  .sort()
  .pop()

const out = [`version: ${versions[0]}`, 'files:']
for (const file of merged) {
  out.push(`  - url: ${file.url}`, `    sha512: ${file.sha512}`, `    size: ${file.size}`)
}
out.push(`path: ${merged[0].url}`, `sha512: ${merged[0].sha512}`)
if (releaseDate !== undefined) out.push(`releaseDate: ${releaseDate}`)
process.stdout.write(out.join('\n') + '\n')
