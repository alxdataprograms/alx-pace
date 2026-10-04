// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MilestoneCelebration } from './MilestoneCelebration'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { achievedMilestones, buildPostText } from '../lib/milestones'
import { SCHEDULES } from '../lib/schedule'

/*
  What a learner reads before posting, rendered.

  jsdom cannot see the bidirectional algorithm at work — only a browser can —
  but it can see whether each English run sits in its own isolate, and whether
  the text on screen is, character for character, the text that gets posted.
*/

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(milestone, lang) {
  // LanguageProvider reads the stored language once, on mount.
  window.localStorage.setItem('alx-lang', lang)
  root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        LanguageProvider,
        null,
        createElement(MilestoneCelebration, { milestone, onDismiss: () => {} }),
      ),
    )
  })
}

const gd = SCHEDULES.gd
const graduated = achievedMilestones(gd, new Set(gd.lessons.map((l) => l.id)), 'gd')
const milestone = (id) => graduated.find((m) => m.id === id)
const postIn = (lang, m) =>
  buildPostText(m, {
    moduleDone: translations[lang].postModuleDone,
    programmeDone: translations[lang].postProgrammeDone,
  })

describe('the milestone dialogue', () => {
  it('isolates every English run of an Arabic post, and shows exactly what is posted', () => {
    const m = milestone('module:GD-3')
    render(m, 'ar')
    const quote = container.querySelector('blockquote')
    const isolated = [...quote.querySelectorAll('bdi')].map((b) => [b.getAttribute('dir'), b.textContent])
    expect(isolated).toEqual([
      ['ltr', 'Poster Design & Visual Composition'],
      ['ltr', 'Poster Design'],
      ['ltr', 'https://alxdataprograms.github.io/alx-pace/share/gd/'],
      ['ltr', '#LifeAtALX'],
    ])
    expect(quote.textContent).toBe(postIn('ar', m))
  })

  it('tells a Graphic Design graduate the programme’s real length, counted in items', () => {
    const m = milestone('programme:gd')
    render(m, 'en')
    expect(container.querySelector('[role="dialog"]').textContent).toContain(
      'All 10 modules, 373 items, 32 weeks.',
    )
    expect(container.querySelector('blockquote').textContent).toBe(postIn('en', m))
  })
})
