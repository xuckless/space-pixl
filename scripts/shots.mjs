// Screenshots of the built app for the GitHub Pages site (docs/screenshots) and
// space.pixlfoundation.com (pixl-web/public/space/shots). Launches out/ with a
// throwaway profile and the real engine, opens sample images through a
// stubbed file dialog, and captures each state with capturePage.
//   pnpm build && node scripts/shots.mjs --raw <file.CR2> --jpeg <file.jpg>
//     [--web <pixl-web dir>] [--docs <dir, default docs/screenshots>] [--review <dir of PNGs>]
// The samples are copied to a temp folder first: converting writes beside them.
// Needs cwebp (brew install webp).
import { _electron as electron } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '..')
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const raw = arg('raw')
const jpeg = arg('jpeg')
const web = arg('web') ? path.resolve(arg('web')) : null
const review = arg('review') ? path.resolve(arg('review')) : null
if (!raw || !jpeg) {
  console.error(
    'usage: node scripts/shots.mjs --raw <file> --jpeg <file> [--web <dir>] [--review <dir>]'
  )
  process.exit(2)
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'space-pixl-shots-'))
const samples = path.join(TMP, 'samples')
fs.mkdirSync(samples)
const copy = (f) => {
  const to = path.join(samples, path.basename(f))
  fs.copyFileSync(f, to)
  return to
}
const RAW = copy(raw)
const JPEG = copy(jpeg)

// Docs keep their 1240 × 860 frame (the app's default window)./
const DOCS = {
  w: 1240,
  h: 860,
  dir: arg('docs') ? path.resolve(arg('docs')) : path.join(ROOT, 'docs', 'screenshots'),
  px: null
}
// Captured at the Space Pixl UI board's 1280 × 800 (it fits any screen) and scaled to the site's 1600 × 1000.
const WEB = {
  w: 1280,
  h: 800,
  dir: web && path.join(web, 'public', 'space', 'shots'),
  px: [1600, 1000]
}

const bin = createRequire(import.meta.url)('electron')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const app = await electron.launch({
  executablePath: bin,
  args: [ROOT],
  env: { ...process.env, SPACE_PIXL_USER_DATA: path.join(TMP, 'profile') },
  timeout: 60_000
})
const page = await app.firstWindow()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text())
})

async function size(frame) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.setContentSize(w, h)
      win.center()
    },
    [frame.w, frame.h]
  )
  await sleep(500)
}

async function capture(name, frame) {
  if (!frame.dir) return
  const b64 = await app.evaluate(async ({ BrowserWindow }) => {
    const img = await BrowserWindow.getAllWindows()[0].webContents.capturePage()
    return img.toPNG().toString('base64')
  })
  const png = path.join(TMP, `${name}-${frame.w}.png`)
  fs.writeFileSync(png, Buffer.from(b64, 'base64'))
  fs.mkdirSync(frame.dir, { recursive: true })
  const out = path.join(frame.dir, `${name}.webp`)
  const resize = frame.px ? ['-resize', String(frame.px[0]), String(frame.px[1])] : []
  execFileSync('cwebp', ['-quiet', '-q', '84', '-m', '6', ...resize, png, '-o', out])
  if (review) {
    fs.mkdirSync(review, { recursive: true })
    fs.copyFileSync(png, path.join(review, `${name}-${frame.w}.png`))
  }
  console.log(`shots: ${path.relative(process.cwd(), out)}`)
}

/** Open a file through the app's own button, with the dialog answering for us. */
async function open(file) {
  await app.evaluate(({ dialog }, f) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] })
  }, file)
  const hero = page.locator('.hero-empty .btn')
  if (await hero.count()) await hero.click()
  else await page.getByRole('button', { name: 'Choose another image…' }).click()
  await page.waitForFunction(
    (name) => document.querySelector('.strip .file .name')?.textContent === name,
    path.basename(file),
    { timeout: 120_000 }
  )
  await settle()
}

/** Wait until nothing is analysing or encoding, and the preview has both sides. */
async function settle() {
  await sleep(700)
  await page.waitForFunction(
    () =>
      !document.querySelector('.loader') &&
      !document.querySelector('.shimmer') &&
      document.querySelectorAll('.stage .layer').length >= 1,
    null,
    { timeout: 180_000 }
  )
  await sleep(1400) // let the entrance animations land
}

async function convert() {
  await page.getByRole('button', { name: 'Convert beside the original' }).click()
  // The Convert card's result (the preview panel has a `.result` of its own).
  const result = '.split-grid > .col:last-child > .card:last-child .result'
  await page.waitForSelector(result, { timeout: 180_000 })
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'end' }), result)
  await sleep(800)
}

async function scrollTo(selector) {
  await page.evaluate(
    (s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }),
    selector
  )
  await sleep(600)
}

async function tab(name) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name }).click()
  await sleep(1600)
}

try {
  await page.waitForSelector('.app', { timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('.splash'), null, { timeout: 60_000 })
  await size(WEB)
  await sleep(1200)
  if (review) await capture('empty', { ...WEB, dir: path.join(TMP, 'discard') })

  // The website: a camera RAW, the lossless DNG story.
  await open(RAW)
  await capture('optimise', WEB)
  await page.getByRole('button', { name: 'Show analysis' }).click()
  await sleep(900)
  await scrollTo('.split-grid .col .card:last-child')
  await capture('analysis', WEB)
  await page.getByRole('button', { name: 'Hide analysis' }).click()
  await convert()

  // The Pages site: the JPEG it has always shown, at the default window size.
  await size(DOCS)
  await open(JPEG)
  await capture('optimise-preview', DOCS)
  await page.getByRole('button', { name: 'Show analysis' }).click()
  await sleep(900)
  await scrollTo('.split-grid .col .card:last-child')
  await capture('optimise-analysis', DOCS)
  await page.getByRole('button', { name: 'Hide analysis' }).click()
  await page.locator('.sec').first().click()
  await sleep(900)
  await capture('optimise-dials', DOCS)
  await page.locator('.sec').first().click()
  await convert()
  await capture('optimise-converted', DOCS)

  await tab('Stats')
  await capture('stats', DOCS)
  await size(WEB)
  await capture('stats', WEB)
  await size(DOCS)
  await scrollTo('.two-up')
  await capture('stats-formats', DOCS)

  await tab('Settings')
  await capture('settings', DOCS)
  if (review) {
    await page.getByRole('button', { name: 'About & legal…' }).click()
    await sleep(1200)
    await capture('about', { ...DOCS, dir: path.join(TMP, 'discard') })
    await page.getByRole('tab', { name: 'Third-party' }).click()
    await sleep(900)
    await capture('about-notices', { ...DOCS, dir: path.join(TMP, 'discard') })
  }
} finally {
  await app.close()
  fs.rmSync(TMP, { recursive: true, force: true })
}
