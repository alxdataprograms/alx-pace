import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/*
  Poppins ships with the app (src/index.css, src/assets/fonts).

  Two ways this quietly breaks, neither visible to any other test:
  - Someone adds font-extrabold to a component. Nothing bundles weight 800,
    so the browser synthesises a fake bold from 700 — no error, just a page
    that no longer looks like alxafrica.com.
  - Someone pastes the Google Fonts snippet back into index.html. The app
    goes back to waiting on a third party before first paint, and loses
    Poppins offline.
*/

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const css = readFileSync(join(SRC, 'index.css'), 'utf8')

/** Every @font-face block for Poppins, as { weight, url, range }. */
function faces() {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map(([, body]) => ({
      family: /font-family:\s*'([^']+)'/.exec(body)?.[1],
      weight: Number(/font-weight:\s*(\d+)/.exec(body)?.[1]),
      url: /url\('([^']+)'\)/.exec(body)?.[1],
      range: /unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? '',
    }))
    .filter((f) => f.family === 'Poppins')
}

const TAILWIND_WEIGHT = {
  'font-thin': 100,
  'font-extralight': 200,
  'font-light': 300,
  'font-normal': 400,
  'font-medium': 500,
  'font-semibold': 600,
  'font-bold': 700,
  'font-extrabold': 800,
  'font-black': 900,
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(jsx?|css)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

describe('the bundled Poppins', () => {
  it('declares a basic-Latin face for every weight the app uses', () => {
    const used = new Set([400])
    for (const file of sourceFiles(SRC)) {
      for (const [cls, weight] of Object.entries(TAILWIND_WEIGHT)) {
        if (new RegExp(`\\b${cls}\\b`).test(readFileSync(file, 'utf8'))) used.add(weight)
      }
    }
    const latin = new Set(faces().filter((f) => f.range.startsWith('U+0000-00FF')).map((f) => f.weight))
    for (const weight of used) {
      expect(latin.has(weight), `font weight ${weight} is used but no Poppins face is bundled`).toBe(true)
    }
  })

  it('points every face at a file that exists, with its licence beside it', () => {
    const all = faces()
    expect(all.length).toBeGreaterThan(0)
    for (const { url } of all) {
      const file = join(SRC, url)
      expect(existsSync(file), url).toBe(true)
      expect(readFileSync(file).subarray(0, 4).toString('latin1'), url).toBe('wOF2')
    }
    expect(existsSync(join(SRC, 'assets/fonts/OFL.txt'))).toBe(true)
  })

  it('never goes back to fetching the font from Google', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})
