// Draws Space Pixl's app icons and installer art from the PIXL Family Kit's
// Space boards, with the mark from src/shared/mark.ts:
//   build/icon.icns            macOS: the tile (AppTile), 16–1024, via iconutil
//   build/icon.png             the 1024 tile, electron-builder's fallback
//   build/icon.ico             Windows: the plateless glass mark, 16–256
//   build/icons/<n>x<n>.png    Linux hicolor: the plateless glass mark, 16–1024
//   resources/icon.png         the window icon on Linux (512 mark)
//   build/background.png, @2x  the DMG window (660 × 400)
//   build/installerSidebar.bmp the NSIS welcome/finish sidebar (164 × 314)
//   build/installerHeader.bmp  the NSIS page header (150 × 57)
//   docs/favicon.ico, icon.png the GitHub Pages site
// Each piece is an HTML page rendered in an offscreen Electron window at its
// real pixel size (small sizes use the kit's small-size rules, not a
// downscale) and captured with capturePage. Run `pnpm brand` on macOS (the
// .icns needs iconutil; elsewhere it is skipped); commit what it writes.
import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { markSvg } from '../src/shared/mark.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const BUILD = path.join(ROOT, 'build')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'space-pixl-brand-'))

const font = (pkg: string, file: string): string =>
  'file://' +
  path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files', file).replace(/\\/g, '/')

const HEAD = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Space Grotesk'; font-weight: 300 700;
  src: url('${font('space-grotesk', 'space-grotesk-latin-wght-normal.woff2')}') format('woff2'); }
html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
* { box-sizing: border-box; }
.wm { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: .28em;
  text-transform: uppercase; color: #ebe9f3; white-space: nowrap; line-height: 1; }
.wm em { font-style: normal; color: #93a4ff; }
</style>`

// ── the pieces ────────────────────────────────────────────────────────────────

/** The macOS tile: Playroom's tile geometry, tinted Space blue (AppTile, kind space). */
function tile(size: number): string {
  const k = size / 1024
  const f = (v: number): string => `${(v * k).toFixed(2)}px`
  const t = 824 * k
  const small = size <= 40
  const mark = Math.round((small ? 790 : 720) * k)
  const shadow =
    size >= 128 ? `0 ${f(20)} ${f(40)} rgba(0,0,0,.45), 0 ${f(4)} ${f(10)} rgba(0,0,0,.3)` : 'none'
  const inner = `inset 0 ${Math.max(1, 3 * k).toFixed(2)}px 0 rgba(255,255,255,.16), inset 0 0 0 ${Math.max(0.5, 2 * k).toFixed(2)}px rgba(255,255,255,.06), inset 0 -${Math.max(1, 4 * k).toFixed(2)}px 0 rgba(147,164,255,.28)`
  return `${HEAD}<div style="position:relative;width:${size}px;height:${size}px">
  <div style="position:absolute;left:${f(100)};top:${f(100)};width:${t}px;height:${t}px;border-radius:${f(185)};overflow:hidden;
    background:radial-gradient(120% 90% at 30% 16%, #141a33 0%, #070910 44%, #030407 100%);box-shadow:${shadow}">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(147,164,255,1) 1px, transparent 1px),linear-gradient(90deg, rgba(147,164,255,1) 1px, transparent 1px);
      background-size:${(t / 14).toFixed(2)}px ${(t / 14).toFixed(2)}px;background-position:center;opacity:${size >= 64 ? 0.07 : 0}"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(70% 45% at 50% 108%, rgba(116,134,240,.55), transparent 70%)"></div>
    <div style="position:absolute;inset:0;border-radius:inherit;box-shadow:${inner}"></div>
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">${markSvg({
      size: mark,
      detail: small ? 'small' : 'full',
      pixels: size >= 128,
      label: ''
    })}</div>
  </div></div>`
}

/** Windows and Linux: no plate, the glass mark on its own; heavy small mark at 48 and under. */
function plain(size: number): string {
  return `${HEAD}<div style="width:${size}px;height:${size}px">${markSvg({
    size,
    detail: size <= 48 ? 'small' : 'full',
    pixels: size >= 128,
    label: ''
  })}</div>`
}

/** The DMG window (SpDmg): the app sits at (165, 180), Applications at (495, 180). */
function dmg(scale: number): string {
  return `${HEAD}<div style="zoom:${scale};position:relative;width:660px;height:400px;overflow:hidden;
    background:radial-gradient(90% 90% at 50% 40%, #0e1224, #000 70%);font-family:'Space Grotesk',sans-serif">
  <div style="position:absolute;left:0;right:0;bottom:0;height:160px;background:radial-gradient(60% 100% at 50% 110%, rgba(116,134,240,.35), transparent 70%)"></div>
  <svg width="660" height="400" style="position:absolute;inset:0" aria-hidden="true">
    <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#93a4ff" stop-opacity="0"/><stop offset="0.7" stop-color="#93a4ff" stop-opacity="0.6"/><stop offset="1" stop-color="#e3e8ff"/></linearGradient></defs>
    <path d="M262 186 Q 330 150 392 180" fill="none" stroke="url(#a)" stroke-width="1.5"/>
    <rect x="392" y="176" width="8" height="8" fill="#e3e8ff"/>
    <rect x="376" y="166" width="5" height="5" fill="#93a4ff" opacity="0.6"/>
    <rect x="360" y="161" width="3" height="3" fill="#93a4ff" opacity="0.3"/>
  </svg>
  <span style="position:absolute;left:0;right:0;bottom:34px;text-align:center;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#9aa3b5">Drag to Applications to install</span>
</div>`
}

/** The NSIS sidebar (SpWinDialog's left panel). */
function sidebar(): string {
  return `${HEAD}<div style="position:relative;width:164px;height:314px;overflow:hidden;background:radial-gradient(120% 70% at 30% 20%, #18204a, #05060c 70%)">
  <div style="position:absolute;left:-60px;bottom:-90px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle, rgba(116,134,240,.55), transparent 65%)"></div>
  <div style="position:absolute;left:12px;top:50px">${markSvg({ size: 140, glow: true, label: '' })}</div>
  <div style="position:absolute;left:18px;bottom:26px;display:flex;flex-direction:column;gap:8px">
    <span class="wm" style="font-size:10px"><em>SPACE</em></span>
    <span class="wm" style="font-size:10px">PIXL</span>
  </div>
  <div style="position:absolute;right:0;top:0;bottom:0;width:1px;background:linear-gradient(180deg, #93a4ff, rgba(147,164,255,.2) 30%, rgba(255,255,255,.08))"></div>
</div>`
}

/**
 * The NSIS page header (SpWinBanner's dark end, mirrored): Modern UI draws it
 * at the header's left, so the Space night sits left and fades into the
 * page's white, with the small mark in it.
 */
function header(): string {
  return `${HEAD}<div style="position:relative;width:150px;height:57px;overflow:hidden;background:#ffffff">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg, #05060c 0, #05060c 42%, rgba(5,6,12,.55) 68%, rgba(5,6,12,0) 100%)"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(60px 44px at 36px 24px, rgba(24,32,74,.95), rgba(24,32,74,0))"></div>
  <div style="position:absolute;left:14px;top:6px">${markSvg({ size: 45, detail: 'small', label: '' })}</div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg, #93a4ff, rgba(147,164,255,.25) 90px, rgba(0,0,0,.08) 150px)"></div>
</div>`
}

// ── rendering ─────────────────────────────────────────────────────────────────

let seq = 0
let win: BrowserWindow | null = null
/** One offscreen window, resized for each piece: creating one per piece races its teardown. */
async function render(html: string, w: number, h: number): Promise<Electron.NativeImage> {
  const file = path.join(TMP, `p${++seq}.html`)
  fs.writeFileSync(file, html)
  win ??= new BrowserWindow({
    show: false,
    width: w,
    height: h,
    useContentSize: true,
    frame: false,
    transparent: true,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  win.setContentSize(w, h)
  await win.loadFile(file)
  await win.webContents.executeJavaScript(
    'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))'
  )
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h })
  const s = img.getSize()
  if (s.width !== w || s.height !== h)
    throw new Error(`captured ${s.width}×${s.height}, wanted ${w}×${h}`)
  return img
}

/** A Windows .ico holding PNG images (Vista and later read these at every size). */
function ico(pngs: { size: number; png: Buffer }[]): Buffer {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e)
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt8(0, e + 2)
    head.writeUInt8(0, e + 3)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(png.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.png)])
}

/** An uncompressed 24-bit BMP, which is what NSIS's Modern UI wants. */
function bmp(img: Electron.NativeImage): Buffer {
  const { width: w, height: h } = img.getSize()
  const bgra = img.toBitmap() // BGRA, top-down
  const row = Math.ceil((w * 3) / 4) * 4
  const data = Buffer.alloc(row * h)
  for (let y = 0; y < h; y++) {
    const src = y * w * 4
    const dst = (h - 1 - y) * row // BMP rows run bottom-up
    for (let x = 0; x < w; x++) {
      const a = bgra[src + x * 4 + 3] / 255
      // flatten any transparency onto white, the installer's page colour
      for (let c = 0; c < 3; c++)
        data[dst + x * 3 + c] = Math.round(bgra[src + x * 4 + c] * a + 255 * (1 - a))
    }
  }
  const head = Buffer.alloc(54)
  head.write('BM', 0, 'ascii')
  head.writeUInt32LE(54 + data.length, 2)
  head.writeUInt32LE(54, 10)
  head.writeUInt32LE(40, 14)
  head.writeInt32LE(w, 18)
  head.writeInt32LE(h, 22)
  head.writeUInt16LE(1, 26)
  head.writeUInt16LE(24, 28)
  head.writeUInt32LE(data.length, 34)
  head.writeInt32LE(2835, 38)
  head.writeInt32LE(2835, 42)
  return Buffer.concat([head, data])
}

function write(file: string, data: Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
  console.log(`brand-art: ${path.relative(ROOT, file)}`)
}

async function main(): Promise<void> {
  // macOS: every iconset size drawn at its own pixel size.
  const tiles = new Map<number, Buffer>()
  for (const s of [16, 32, 64, 128, 256, 512, 1024])
    tiles.set(s, (await render(tile(s), s, s)).toPNG())
  write(path.join(BUILD, 'icon.png'), tiles.get(1024)!)
  if (process.platform === 'darwin') {
    const set = path.join(TMP, 'icon.iconset')
    fs.mkdirSync(set)
    for (const s of [16, 32, 128, 256, 512]) {
      fs.writeFileSync(path.join(set, `icon_${s}x${s}.png`), tiles.get(s)!)
      fs.writeFileSync(path.join(set, `icon_${s}x${s}@2x.png`), tiles.get(s * 2)!)
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(BUILD, 'icon.icns')])
    console.log('brand-art: build/icon.icns')
  } else {
    console.warn('brand-art: build/icon.icns skipped (iconutil is macOS only)')
  }

  // Windows and Linux: the plateless mark.
  const marks = new Map<number, Buffer>()
  for (const s of [16, 24, 32, 48, 64, 128, 256, 512, 1024])
    marks.set(s, (await render(plain(s), s, s)).toPNG())
  const winIco = ico(
    [16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: marks.get(size)! }))
  )
  write(path.join(BUILD, 'icon.ico'), winIco)
  for (const s of [16, 24, 32, 48, 64, 128, 256, 512, 1024])
    write(path.join(BUILD, 'icons', `${s}x${s}.png`), marks.get(s)!)
  write(path.join(ROOT, 'resources', 'icon.png'), marks.get(512)!)

  // Installers.
  write(path.join(BUILD, 'background.png'), (await render(dmg(1), 660, 400)).toPNG())
  write(path.join(BUILD, 'background@2x.png'), (await render(dmg(2), 1320, 800)).toPNG())
  write(path.join(BUILD, 'installerSidebar.bmp'), bmp(await render(sidebar(), 164, 314)))
  write(path.join(BUILD, 'installerHeader.bmp'), bmp(await render(header(), 150, 57)))

  // The GitHub Pages site.
  write(
    path.join(ROOT, 'docs', 'favicon.ico'),
    ico([16, 32, 48, 64, 128, 256].map((size) => ({ size, png: marks.get(size)! })))
  )
  write(path.join(ROOT, 'docs', 'icon.png'), tiles.get(512)!)
}

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.dock?.hide()
app
  .whenReady()
  .then(main)
  .then(
    () => 0,
    (err) => {
      console.error(err)
      return 1
    }
  )
  .then((code) => {
    win?.destroy()
    fs.rmSync(TMP, { recursive: true, force: true })
    app.exit(code)
  })
