// Writes every third-party component Space Pixl ships, with its licence:
//   build/THIRD_PARTY_NOTICES.txt    plain text, beside the app and on the web
//   build/third-party-notices.json   the same, structured, for the About dialog
// electron-builder bundles both (extraResources); the app reads the JSON.
//   node scripts/third-party-notices.mjs [--web <pixl-web dir>]
// Three sources, as in Pixl Playroom's script of the same name:
//   - the native components npm can't see (build/third-party.json), with
//     licence texts from build/licenses/;
//   - the production npm packages (pnpm licenses), which ship in node_modules;
//   - the packages bundled into the app's JavaScript (out/*/bundled-packages.json,
//     written by electron.vite.config.ts), so run `electron-vite build` first.
// --web also copies the text into pixl-web, for space.pixlfoundation.com/legal/third-party/.
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_TXT = path.join(ROOT, 'build', 'THIRD_PARTY_NOTICES.txt')
const OUT_JSON = path.join(ROOT, 'build', 'third-party-notices.json')
const LICENSES = path.join(ROOT, 'build', 'licenses')
const RULE = '-'.repeat(78)
const own = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

const webAt = process.argv.indexOf('--web')
const web = webAt > 0 ? path.resolve(process.argv[webAt + 1] ?? '') : null

/** The licence file a package ships, if any. */
function licenseText(dir) {
  let files
  try {
    files = fs.readdirSync(dir)
  } catch {
    return null
  }
  const f = files.find((n) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(n))
  return f ? fs.readFileSync(path.join(dir, f), 'utf8').trim() : null
}

function spdxText(id) {
  const f = path.join(LICENSES, `${id}.txt`)
  if (!fs.existsSync(f)) throw new Error(`no licence text for ${id} in build/licenses/`)
  return fs.readFileSync(f, 'utf8').trim()
}

// ── npm: production dependencies and bundled packages ─────────────────────────
/** name@version → { name, version, license, text, homepage } */
const npm = new Map()
function addPackage(dir, fallbackLicense) {
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    return
  }
  // The PIXL engine is our own closed component, not third-party software.
  if (!pkg.name || pkg.name.startsWith('@xuckless/')) return
  const key = `${pkg.name}@${pkg.version}`
  if (npm.has(key)) return
  const license =
    typeof pkg.license === 'string'
      ? pkg.license
      : (pkg.license?.type ?? fallbackLicense ?? 'UNKNOWN')
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  npm.set(key, {
    name: pkg.name,
    version: pkg.version,
    license,
    text: licenseText(dir),
    source: (pkg.homepage ?? repo ?? `https://www.npmjs.com/package/${pkg.name}`)
      .replace(/^git\+/, '')
      .replace(/\.git$/, '')
  })
}

const listed = JSON.parse(
  execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // pnpm is a .cmd shim on Windows, which only a shell can run
    shell: process.platform === 'win32'
  })
)
for (const [license, pkgs] of Object.entries(listed))
  for (const p of pkgs) for (const dir of p.paths ?? []) addPackage(dir, license)

let bundled = 0
for (const target of ['main', 'preload', 'renderer']) {
  const f = path.join(ROOT, 'out', target, 'bundled-packages.json')
  if (!fs.existsSync(f)) {
    console.warn(
      `third-party-notices: ${path.relative(ROOT, f)} missing; run electron-vite build first`
    )
    continue
  }
  for (const dir of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    addPackage(dir)
    bundled++
  }
}

// ── native components ─────────────────────────────────────────────────────────
const { components } = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'build', 'third-party.json'), 'utf8')
)
const ids = new Set()

const out = []
const say = (...lines) => out.push(...lines)
say(
  'SPACE PIXL: THIRD-PARTY NOTICES',
  '',
  `Space Pixl ${own.version} includes the third-party software listed below. Each`,
  'component is used under its own licence, reproduced here or in section 3. Space',
  'Pixl itself is proprietary software; these licences cover only the components',
  'they name.',
  '',
  'Components under the GNU LGPL are shipped as separate shared libraries inside the',
  'application, which you may replace with your own builds, except where noted.',
  'Their source code is available from the addresses given; we will also provide it',
  'on request, for three years from when you received this copy, from',
  'hello@pixlfoundation.com.',
  '',
  '  1. Native components',
  '  2. npm packages',
  '  3. Licence texts',
  '',
  RULE,
  '1. NATIVE COMPONENTS',
  RULE
)
const native = []
for (const c of components) {
  const lic = [c.license].flat()
  lic.forEach((id) => ids.add(id))
  const licenseName = c.licenseName ?? lic.join(' and ')
  say(
    '',
    c.name,
    `  Used for:  ${c.use}`,
    `  Licence:   ${licenseName} (section 3)`,
    `  Source:    ${c.source}`,
    `  ${c.copyright}`
  )
  if (c.dynamic) say('  Shipped as a separate shared library, loaded at run time.')
  if (c.note) say(`  Note: ${c.note}`)
  native.push({
    name: c.name,
    license: licenseName,
    licenseIds: lic,
    use: c.use,
    source: c.source,
    copyright: c.copyright,
    dynamic: Boolean(c.dynamic),
    note: c.note ?? null
  })
}

say('', RULE, '2. NPM PACKAGES', RULE)
const packages = []
for (const p of [...npm.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  say('', `${p.name} ${p.version}`, `  Licence: ${p.license}`)
  const entry = {
    name: p.name,
    version: p.version,
    license: p.license,
    licenseIds: [],
    source: p.source,
    text: p.text
  }
  if (p.text)
    say(
      '',
      p.text
        .split('\n')
        .map((l) => (l ? `    ${l}` : ''))
        .join('\n')
    )
  else if (
    /^[A-Za-z0-9.+-]+$/.test(p.license) &&
    fs.existsSync(path.join(LICENSES, `${p.license}.txt`))
  ) {
    ids.add(p.license)
    entry.licenseIds = [p.license]
    say('  (No licence file shipped; the licence text is in section 3.)')
  }
  packages.push(entry)
}

say('', RULE, '3. LICENCE TEXTS', RULE)
const texts = {}
for (const id of [...ids].sort()) {
  texts[id] = spdxText(id)
  say('', `== ${id} ==`, '', texts[id])
}

const text = out.join('\n').replace(/[ \t]+$/gm, '') + '\n'
fs.writeFileSync(OUT_TXT, text)
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify({ app: own.version, native, packages, texts }, null, 1) + '\n'
)
console.log(
  `third-party-notices: ${path.relative(ROOT, OUT_TXT)} and ${path.basename(OUT_JSON)}: ${components.length} native components, ${npm.size} npm packages (${bundled} bundled), ${ids.size} licence texts`
)
if (web) {
  // /shared/ is served on every pixlfoundation.com host.
  const dest = path.join(web, 'public', 'shared', 'legal', 'space-third-party-notices.txt')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(OUT_TXT, dest)
  console.log(`third-party-notices: copied to ${dest}`)
}
