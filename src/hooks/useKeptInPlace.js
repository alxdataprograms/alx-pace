import { useCallback, useState } from 'react'

/**
 * Rows the learner has toggled on a card, kept on screen until it remounts.
 *
 * WHY
 * Some lists are filtered by completion — the catch-up list shows only open
 * items, and a long focus week tucks finished ones away. Filtering on every
 * render meant a tick made the row vanish under the learner's finger: an
 * accidental tick could not be undone from where it happened, and keyboard and
 * screen-reader focus fell off the removed button onto the page body.
 *
 * So a row touched here stays exactly where it was, struck through, until the
 * card is mounted afresh (a reload, the next week, another program). The
 * filtering still decides what a learner sees when they arrive; it just no
 * longer rearranges the list while they are using it.
 *
 * Session-only by design: nothing is persisted, so there is no new storage key
 * and nothing for the origin handoff to decide about.
 *
 * @param {(id: string) => void} onToggle  the real toggle (useLearnerProfile)
 * @returns {[Map<string, object>, (lesson: object) => void]}
 */
export function useKeptInPlace(onToggle) {
  const [kept, setKept] = useState(() => new Map())

  const toggle = useCallback(
    (lesson) => {
      setKept((prev) => (prev.has(lesson.id) ? prev : new Map(prev).set(lesson.id, lesson)))
      onToggle(lesson.id)
    },
    [onToggle],
  )

  return [kept, toggle]
}

/**
 * `visible` plus every kept row not already in it, in curriculum order.
 * Pure, so the merge can be tested without rendering.
 */
export function withKept(visible, kept) {
  const ids = new Set(visible.map((l) => l.id))
  const extra = [...kept.values()].filter((l) => !ids.has(l.id))
  if (extra.length === 0) return visible
  return [...visible, ...extra].sort((a, b) => a.sequence - b.sequence)
}
