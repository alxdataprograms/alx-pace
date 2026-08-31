import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

/*
  THE ONE FAILURE A REVERT CANNOT UNDO.

  Every other mistake in this app is recoverable: a bad deploy is one `git
  revert` away, and every commit on main has passed lint, tests, the parser
  check and a build before it reached anybody.

  Learner progress is different. It lives only in each learner's own browser —
  no backend, no backup, by design. Roll the code back after a change that
  clears localStorage and the old app returns; fourteen weeks of someone's
  ticked lessons do not. There is nowhere to restore them from.

  So this file guards a structural property rather than a behaviour: exactly
  ONE module is allowed to destroy stored state, and it is the one whose whole
  job is storage. Everything else may write; nothing else may remove.

  Only the removal property is asserted here. The handoff's "union, never
  replace" rule is the other half of protecting progress, but handoff.test.js
  already proves it by BEHAVIOUR — running the merge and checking the result —
  which is strictly better than grepping the source for the shape of the code
  that does it. A structural check earns its place only where nothing else can
  see the property; that one can.

  It is a blunt check on purpose. A subtle one that understood context could be
  argued with; this cannot, which is the point — the reviewer who would have to
  argue with it is the one about to lose somebody's progress.
*/

const SRC = fileURLToPath(new URL('..', import.meta.url))

// The single module permitted to remove keys. `useLocalStorage` removes one key
// when its value is set back to the default — that is the deliberate, tested
// path, and it is scoped to one key it owns.
const CUSTODIAN = 'hooks/useLocalStorage.js'

const DESTRUCTIVE = [
  { pattern: /localStorage\s*\.\s*clear\s*\(/, what: 'localStorage.clear()' },
  { pattern: /localStorage\s*\.\s*removeItem\s*\(/, what: 'localStorage.removeItem()' },
  // Destructuring the method out is the obvious way round the two above.
  { pattern: /\{[^}]*\b(clear|removeItem)\b[^}]*\}\s*=\s*\w*[Ss]torage/, what: 'a destructured remover' },
]

const sourceFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f))
  .map((f) => f.split('\\').join('/'))

describe('only the storage hook may destroy learner progress', () => {
  it('finds source files to check at all', () => {
    // A guard that silently checks nothing is worse than no guard, because it
    // reports green. If a refactor moves or renames src/, this fails loudly.
    expect(sourceFiles.length).toBeGreaterThan(10)
    expect(sourceFiles).toContain(CUSTODIAN)
  })

  it.each(DESTRUCTIVE)('no module outside the hook calls $what', ({ pattern, what }) => {
    const offenders = sourceFiles
      .filter((f) => f !== CUSTODIAN)
      .filter((f) => pattern.test(readFileSync(join(SRC, f), 'utf8')))

    expect(
      offenders,
      offenders.length
        ? `${what} in ${offenders.join(', ')}.\n\n` +
          'Learner progress exists in one place: that browser. Removing it is ' +
          'not revertible — a code rollback restores the app, not the data. If ' +
          'this is genuinely intended, route it through useLocalStorage and say ' +
          'why here.'
        : '',
    ).toEqual([])
  })
})
