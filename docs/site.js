/* Space Pixl site: download detection, the savings calculator, the measured
   bars, engine tabs, the gallery lightbox and the sticky nav. No framework. */

const REPO = 'xuckless/space-pixl'
const FALLBACK_VERSION = '0.1.4' // x-release-please-version

// Measured on the engine's 8.04 MB JPEG fixture (Apple M2 Pro, release build).
const MEASURED = [
  { key: 'avif', name: 'AVIF q60', mb: 2.58 },
  { key: 'webp', name: 'WebP q80', mb: 3.26 },
  { key: 'jxl1', name: 'JPEG XL distance 1', mb: 5.53 },
  { key: 'jxl', name: 'JPEG XL repack (bit-exact)', mb: 6.55 },
  { key: 'jpeg', name: 'the JPEG itself', mb: 8.04 },
  { key: 'heic', name: 'HEIC q80', mb: 9.66, worse: true },
  { key: 'jxll', name: 'JPEG XL lossless', mb: 22.93, worse: true },
  { key: 'png', name: 'PNG', mb: 38.7, worse: true }
]
const SOURCE_MB = 8.04
const TARGET_NOTES = {
  jxl: 'Bit-exact and reversible: the original JPEG can be restored byte for byte at any time.',
  avif: 'Lossy. A second generation of loss on an already-lossy JPEG; the app previews it at 1:1 so you can judge.',
  webp: 'Lossy, always 8-bit 4:2:0, and no side may exceed 16383 pixels.',
  jxl1: 'Visually lossless: distance 1 is below the threshold most eyes notice, but it is still a re-encode.'
}

document.documentElement.classList.add('js')

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

// ── Download detection ──────────────────────────────────────────────────────

function detectPlatform() {
  const ua = navigator.userAgent || ''
  const uad = navigator.userAgentData
  const platform = (uad && uad.platform) || navigator.platform || ''
  if (/Windows/i.test(platform) || /Windows/i.test(ua)) return { os: 'win', arch: 'x64' }
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    // Browsers do not expose the CPU on macOS; guess from what little there is.
    let arch = 'arm64'
    try {
      const gl = document.createElement('canvas').getContext('webgl')
      const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''
      if (/Intel|AMD|Radeon/i.test(renderer)) arch = 'x64'
    } catch {
      /* keep the guess */
    }
    return { os: 'mac', arch }
  }
  return { os: 'other', arch: '' }
}

function assetFor(os, arch, version) {
  const base = `https://github.com/${REPO}/releases/download/v${version}/`
  if (os === 'win') return { key: 'win-x64', name: `space-pixl-${version}-setup.exe`, base }
  if (os === 'mac') {
    const a = arch === 'x64' ? 'x64' : 'arm64'
    return { key: `mac-${a}`, name: `space-pixl-${version}-${a}.dmg`, base }
  }
  return null
}

function applyRelease(version, assets) {
  const byName = new Map((assets || []).map((a) => [a.name, a]))
  const link = (key, name) => {
    const a = byName.get(name)
    const url = a
      ? a.browser_download_url
      : `https://github.com/${REPO}/releases/latest/download/${name}`
    $$(`[data-asset="${key}"]`).forEach((el) => {
      el.href = url
      if (a && a.size) el.title = `${name} · ${(a.size / 1048576).toFixed(1)} MB`
    })
    $$(`[data-asset-name="${key}"]`).forEach((el) => (el.textContent = name))
  }
  link('mac-arm64', `space-pixl-${version}-arm64.dmg`)
  link('mac-x64', `space-pixl-${version}-x64.dmg`)
  link('win-x64', `space-pixl-${version}-setup.exe`)
  $$('[data-version]').forEach((el) => (el.textContent = `v${version}`))

  const { os, arch } = detectPlatform()
  const mine = assetFor(os, arch, version)
  const primary = $('#cta-primary')
  if (mine) {
    primary.href =
      byName.get(mine.name)?.browser_download_url ||
      `https://github.com/${REPO}/releases/latest/download/${mine.name}`
    $('#cta-primary-label').textContent =
      os === 'win' ? 'Download for Windows' : `Download for macOS`
    $('#cta-primary-sub').textContent =
      os === 'win' ? 'x64 · .exe' : `${arch === 'x64' ? 'Intel' : 'Apple Silicon'} · .dmg`
    $(os === 'win' ? '#dl-win' : '#dl-mac')?.classList.add('mine')
  } else {
    $('#cta-primary-label').textContent = 'Download'
    $('#cta-primary-sub').textContent = 'macOS · Windows'
  }
}

async function loadRelease() {
  applyRelease(FALLBACK_VERSION, [])
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!r.ok) return
    const rel = await r.json()
    const version = String(rel.tag_name || '').replace(/^v/, '')
    if (!/^\d+\.\d+\.\d+/.test(version)) return
    applyRelease(version, rel.assets)
    const when = rel.published_at ? new Date(rel.published_at) : null
    const line = $('#release-line')
    if (line) {
      line.innerHTML = `Latest release: <a href="${rel.html_url}">v${version} on GitHub</a>${
        when
          ? `, published ${when.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
          : ''
      }.`
    }
  } catch {
    /* offline or rate-limited: the stamped fallback stays */
  }
}

// ── Savings calculator ──────────────────────────────────────────────────────

const calc = {
  gb: 200,
  target: 'jxl',
  range: $('#gb'),
  field: $('#gb-field'),
  saved: $('#saved'),
  pct: $('#saved-pct'),
  keep: $('#keep'),
  foot: $('#foot')
}

function ratioFor(target) {
  const m = MEASURED.find((x) => x.key === target)
  return m ? m.mb / SOURCE_MB : 1
}

function renderCalc() {
  const ratio = ratioFor(calc.target)
  const saved = calc.gb * (1 - ratio)
  calc.saved.textContent = saved >= 100 ? saved.toFixed(0) : saved.toFixed(1)
  calc.pct.textContent = `−${((1 - ratio) * 100).toFixed(1)}%`
  calc.keep.style.width = `${(ratio * 100).toFixed(1)}%`
  calc.foot.textContent = TARGET_NOTES[calc.target] || ''
  const pct = ((calc.range.value - calc.range.min) / (calc.range.max - calc.range.min)) * 100
  calc.range.style.setProperty('--pct', `${pct}%`)
}

function setGb(v, from) {
  const n = Math.max(1, Math.min(100000, Number(v) || 0))
  calc.gb = n
  if (from !== 'range') calc.range.value = Math.min(n, Number(calc.range.max))
  if (from !== 'field') calc.field.value = n
  renderCalc()
}

calc.range?.addEventListener('input', (e) => setGb(e.target.value, 'range'))
calc.field?.addEventListener('input', (e) => setGb(e.target.value, 'field'))
$$('.seg [data-target]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.seg [data-target]').forEach((x) => x.classList.toggle('on', x === b))
    calc.target = b.dataset.target
    renderCalc()
  })
)
if (calc.range) renderCalc()

// ── Measured bars ───────────────────────────────────────────────────────────

function renderBars() {
  const host = $('#bars')
  if (!host) return
  const max = Math.max(...MEASURED.map((m) => m.mb))
  host.innerHTML = MEASURED.map((m) => {
    const delta = ((m.mb / SOURCE_MB - 1) * 100).toFixed(0)
    const cls = m.key === 'jpeg' ? '' : m.worse ? 'warn' : m.key === 'jxl' ? 'ok' : ''
    const val =
      m.key === 'jpeg'
        ? `${m.mb.toFixed(2)} MB`
        : `${m.mb.toFixed(2)} MB · ${delta > 0 ? '+' : ''}${delta}%`
    return `<div class="bar ${cls}"><span class="name">${m.name}</span><span class="track"><span class="fill" data-w="${((m.mb / max) * 100).toFixed(1)}"></span></span><span class="val">${val}</span></div>`
  }).join('')
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return
        $$('.fill', en.target).forEach((f) => (f.style.width = `${f.dataset.w}%`))
        io.disconnect()
      })
    },
    { threshold: 0.3 }
  )
  io.observe(host)
}
renderBars()

// ── Engine tabs ─────────────────────────────────────────────────────────────

$$('.etabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.etabs [data-tab]').forEach((x) => {
      const on = x === b
      x.classList.toggle('on', on)
      x.setAttribute('aria-selected', String(on))
    })
    $$('.epanel').forEach((p) => p.classList.toggle('on', p.dataset.panel === b.dataset.tab))
  })
)

// ── Gallery lightbox ────────────────────────────────────────────────────────

const shots = $$('#gallery .shot').map((b) => ({
  src: $('img', b).getAttribute('src'),
  alt: $('img', b).alt,
  cap: $('.cap', b).textContent.trim()
}))
const lb = $('#lightbox')
let lbIndex = 0

function openLb(i) {
  lbIndex = (i + shots.length) % shots.length
  const s = shots[lbIndex]
  $('#lb-img').src = s.src
  $('#lb-img').alt = s.alt
  $('#lb-cap').textContent = s.cap
  lb.classList.add('open')
  document.body.style.overflow = 'hidden'
  $('#lb-close').focus()
}

function closeLb() {
  lb.classList.remove('open')
  document.body.style.overflow = ''
}

$$('#gallery .shot').forEach((b) => b.addEventListener('click', () => openLb(Number(b.dataset.i))))
$('#lb-close')?.addEventListener('click', closeLb)
$('#lb-prev')?.addEventListener('click', () => openLb(lbIndex - 1))
$('#lb-next')?.addEventListener('click', () => openLb(lbIndex + 1))
lb?.addEventListener('click', (e) => {
  if (e.target === lb) closeLb()
})
document.addEventListener('keydown', (e) => {
  if (!lb.classList.contains('open')) return
  if (e.key === 'Escape') closeLb()
  if (e.key === 'ArrowLeft') openLb(lbIndex - 1)
  if (e.key === 'ArrowRight') openLb(lbIndex + 1)
})

// ── Sticky nav + reveal ─────────────────────────────────────────────────────

const navFor = {
  how: 'how',
  savings: 'savings',
  tour: 'savings',
  engine: 'engine',
  playroom: 'engine',
  download: 'download'
}
const sections = $$('main section[id]')
const navIo = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return
      const key = navFor[en.target.id]
      if (!key) return
      $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === key))
    })
  },
  { rootMargin: '-40% 0px -55% 0px' }
)
sections.forEach((s) => navIo.observe(s))

const riseIo = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('in')
        riseIo.unobserve(en.target)
      }
    })
  },
  { threshold: 0.15 }
)
$$('.rise').forEach((el) => riseIo.observe(el))
// Belt and braces: nothing stays hidden if the observer never fires.
setTimeout(() => $$('.rise').forEach((el) => el.classList.add('in')), 1500)

loadRelease()
