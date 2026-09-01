import { useEffect, useRef, useState } from 'react'
import { Share2, X } from 'lucide-react'

import { useLang } from '../i18n/LanguageContext'
import { buildPostText, CAMPAIGN_HASHTAG } from '../lib/milestones'
import { shareToLinkedIn } from '../lib/share'

/**
 * Shown once, when a learner finishes a module or the whole programme.
 *
 * THE POST IS VISIBLE BEFORE THEY LEAVE
 * The text is on screen, in full, including the campaign hashtag — not hidden
 * behind a button that opens LinkedIn with something they have not read.
 * Nobody should discover what they published by seeing it on their feed.
 *
 * DISMISSING COUNTS AS SEEN
 * "Not now" marks the milestone seen and it does not come back. That is the
 * point: a dialogue that reappears until you share is a dark pattern, and this
 * is a suggestion rather than a task. Someone who wants it later has their
 * progress on the page; the app does not need to nag.
 */
export function MilestoneCelebration({ milestone, onDismiss }) {
  const { t, lang } = useLang()
  const [status, setStatus] = useState(null)
  const dialog = useRef(null)
  const shareButton = useRef(null)

  /*
    `post` is what gets copied and sent to LinkedIn — one string, hashtag and
    all. `body` is only for display, because the hashtag has to be rendered as
    an isolated LTR run to survive Arabic. The two must not drift, so the body
    is derived from the post rather than built a second way.
  */
  const post = buildPostText(milestone, {
    moduleDone: t.postModuleDone,
    programmeDone: t.postProgrammeDone,
  })
  const body = post.slice(0, post.lastIndexOf(CAMPAIGN_HASHTAG)).trimEnd()

  /*
    Escape closes it, and focus starts on the primary action.

    Without the key handler this is a box that traps someone who reached it by
    keyboard — the dialogue covers the page and the only way out would be a
    mouse.
  */
  useEffect(() => {
    shareButton.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const share = async () => {
    // The copy STARTS before the open, and the open does not wait for it.
    // Both halves matter and they break different platforms: opening first
    // loses the clipboard to focus, and awaiting the copy loses the open to
    // iOS Safari's popup blocker. See src/lib/share.js.
    const { copied, opened, method } = await shareToLinkedIn(post)
    // The system share sheet is its own feedback. Adding "copied to clipboard"
    // underneath it would be noise about a step the learner did not take.
    if (method === 'native' && opened) setStatus(null)
    else setStatus(copied ? t.milestoneCopied : t.milestoneOpened)
  }

  const isProgramme = milestone.kind === 'programme'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        // Only the backdrop itself, never a click that started on the card.
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-title"
        dir={t.dir}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              id="milestone-title"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-alxgreen-700 dark:text-alxgreen"
            >
              {isProgramme ? t.milestoneProgrammeTitle : t.milestoneModuleTitle(milestone)}
            </p>
            <p className="mt-1 text-sm text-ink-soft dark:text-paper/70">
              {isProgramme
                ? t.milestoneProgrammeSub(milestone)
                : t.milestoneModuleSub(milestone)}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.milestoneDismiss}
            className="-m-2 shrink-0 p-2 text-ink-soft/60 hover:text-ink-soft dark:text-paper/50 dark:hover:text-paper/80"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft dark:text-paper/70">
          {t.milestoneShareIntro}
        </p>

        {/*
          The exact text, shown as text rather than in an editable box. Editing
          happens on LinkedIn, where they can see how it will look; a second
          editor here would be one more thing to maintain and would let the
          hashtag be removed before it was ever seen in context.

          lang and dir are set explicitly: the post is written in the learner's
          language, which is not necessarily the page's when they have just
          switched.
        */}
        <blockquote
          lang={lang}
          dir={t.dir}
          className="mt-3 whitespace-pre-line rounded-lg bg-navy-900/5 p-4 text-sm leading-relaxed text-ink dark:bg-white/5 dark:text-paper"
        >
          {body}
          {'\n\n'}
          {/*
            The hashtag is isolated as its own LTR run, and this is not a
            nicety. Rendered inside the Arabic paragraph it came out as
            "IAmTheStory_ALX#" — the bidirectional algorithm moves a leading #
            to the visual end of a Latin run in RTL text. The STRING was always
            correct, so what reached LinkedIn was fine; what the learner saw
            looked like a broken hashtag, which is worse than it sounds for the
            one element the whole feature exists to deliver.

            <bdi> isolates it without changing a character of the text.
          */}
          <bdi dir="ltr">{CAMPAIGN_HASHTAG}</bdi>
        </blockquote>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            ref={shareButton}
            type="button"
            onClick={() => void share()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cobalt px-5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
          >
            <Share2 size={15} aria-hidden="true" />
            {t.milestoneShare}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] items-center rounded-full border border-ink/20 px-5 text-sm font-semibold text-ink-soft transition-colors hover:bg-navy-900/5 dark:border-white/20 dark:text-paper/80 dark:hover:bg-white/5"
          >
            {t.milestoneDismiss}
          </button>
        </div>

        {status ? (
          <p role="status" className="mt-3 text-[12px] text-ink-soft dark:text-paper/60">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  )
}
