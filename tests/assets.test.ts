/**
 * The download links in README.md and docs/index.html point at
 * `releases/latest/download/<name>`, which only resolves when `<name>` is the
 * same in every release. So no artifact name may carry the version, and the
 * documented names must be exactly the ones electron-builder produces.
 *
 * A version in the name is not merely stale, it is unfixable: release-please
 * reads the `-arm64.dmg` in `space-pixl-0.1.4-arm64.dmg` as a semver
 * prerelease tag and replaces the whole of `0.1.4-arm64.dmg` with the new
 * version, leaving a URL with no file extension.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8')

const builderConfig = read('electron-builder.yml')
const appName = JSON.parse(read('package.json')).name as string

/** Every `artifactName:` template in electron-builder.yml. */
function artifactNames(): { indent: string; template: string }[] {
  return [...builderConfig.matchAll(/^(\s*)artifactName: (.+)$/gm)].map((m) => ({
    indent: m[1],
    template: m[2]
  }))
}

/** One `artifactName:` template, by the section it sits under. */
function templateFor(section: string): string {
  const pattern = new RegExp(`^${section}:\\n(?:[ \\t].*\\n|\\n)*?\\s+artifactName: (.+)$`, 'm')
  const match = pattern.exec(builderConfig)
  assert.ok(match, `no artifactName under ${section}: in electron-builder.yml`)
  return match[1]
}

function expand(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    assert.ok(key in vars, `unexpected macro \${${key}} in ${template}`)
    return vars[key]
  })
}

/** The assets README.md and docs/ hand people directly. */
function documentedAssets(): string[] {
  return [
    expand(templateFor('dmg'), { name: appName, arch: 'arm64', ext: 'dmg' }),
    expand(templateFor('dmg'), { name: appName, arch: 'x64', ext: 'dmg' }),
    expand(templateFor('nsis'), { name: appName, ext: 'exe' })
  ]
}

test('no artifact name carries the version', () => {
  for (const { template } of artifactNames()) {
    assert.doesNotMatch(
      template,
      /\$\{version\}/,
      `${template} carries \${version}, so releases/latest/download links to it would break`
    )
  }
  assert.ok(
    artifactNames().length >= 4,
    'expected artifactName for the app, dmg, nsis and AppImage'
  )
})

test('every documented download link names an asset electron-builder builds', () => {
  const expected = new Set(documentedAssets())
  for (const file of ['README.md', 'docs/index.html']) {
    const urls = [...read(file).matchAll(/releases\/latest\/download\/([^"')\s]+)/g)].map(
      (m) => m[1]
    )
    assert.ok(urls.length > 0, `${file} documents no download links`)
    for (const asset of urls) {
      assert.ok(expected.has(asset), `${file} links to ${asset}, which no target produces`)
    }
  }
})

test('the site falls back to the same asset names', () => {
  const site = read('docs/site.js')
  const block = /const ASSETS = \{([^}]*)\}/.exec(site)
  assert.ok(block, 'docs/site.js has no ASSETS map')
  const names = [...block[1].matchAll(/'([^']+\.(?:dmg|exe))'/g)].map((m) => m[1])
  assert.deepEqual(new Set(names), new Set(documentedAssets()))
})

test('no versioned asset name is left anywhere in the docs', () => {
  for (const file of ['README.md', 'docs/index.html', 'docs/site.js']) {
    assert.doesNotMatch(
      read(file),
      new RegExp(`${appName}-\\d+\\.\\d+\\.\\d+`),
      `${file} still names an asset by version`
    )
  }
})
