import { useEffect, useRef, useState } from 'react'
import { MessagesSquare, Share2, X } from 'lucide-react'

import { useLang } from '../i18n/LanguageContext'
import { buildPostText, postParts } from '../lib/milestones'
import { shareToCommunity, shareToLinkedIn } from '../lib/share'

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
  const overlay = useRef(null)
  const dialog = useRef(null)
  const shareButton = useRef(null)

  /*
    `post` is what gets copied and sent to LinkedIn — one string, hashtag and
    all. The parts are only for display, because the hashtag, the URL and the
    English curriculum titles each have to be rendered as an isolated LTR run
    to survive Arabic. The two must not drift, so the parts come from the same
    translation as the post rather than being built a second way.
  */
  const strings = { moduleDone: t.postModuleDone, programmeDone: t.postProgrammeDone }
  const post = buildPostText(milestone, strings)
  const { runs, url, hashtag } = postParts(milestone, strings)

  /*
    Focus starts on the primary action, and on closing goes back to whatever
    had it before: the roadmap's Share button, or the lesson whose tick
    finished the module. Closing used to drop it on the page body, which sends
    a keyboard or screen-reader user back to the top of the page.

    While it is open the page behind is inert, so neither Tab nor a screen
    reader's reading cursor can wander into what it covers: the third Tab used
    to leave the dialogue for the page underneath.

    Once per dialogue, on mount: this effect used to re-run whenever
    onDismiss changed (a tick in another tab does that), and each re-run
    pulled focus back to the share button mid-dialogue.
  */
  useEffect(() => {
    // Never the dialogue's own share button: StrictMode runs this twice in
    // development, and when nothing had focus before, the second run finds
    // that button focused.
    const previous = document.activeElement
    const opener = overlay.current.contains(previous) ? null : previous
    shareButton.current?.focus()
    const behind = [...overlay.current.parentElement.children].filter(
      (el) => el !== overlay.current && !el.hasAttribute('inert'),
    )
    for (const el of behind) el.setAttribute('inert', '')
    return () => {
      // Lifted first: an inert element cannot take focus back.
      for (const el of behind) el.removeAttribute('inert')
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) {
        opener.focus()
      }
    }
  }, [])

  /*
    Escape closes it. Without that this is a box that traps someone who
    reached it by keyboard — the dialogue covers the page and the only way out
    would be a mouse. Tab and Shift+Tab wrap around its own controls: with the
    page inert, the browser would otherwise carry focus past the last one,
    out to its own toolbar.
  */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss()
      else if (e.key === 'Tab') wrapTab(e, dialog.current)
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

  /*
    Circle cannot be prefilled — its composer is a modal with no URL and it
    ignores query parameters, checked against the live community. So this copies
    the post and opens the space; the learner pastes. That is the whole
    mechanism here rather than a fallback, which is why the status line always
    mentions pasting.
  */
  const shareCommunity = async () => {
    const { copied } = await shareToCommunity(post, { program: milestone.program })
    setStatus(copied ? t.milestoneCommunityOpened : t.milestoneOpened)
  }

  const isProgramme = milestone.kind === 'programme'

  return (
    <div
      ref={overlay}
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
          {/*
            44×44, the app's tap target; it was 34×34. The negative margin
            (half of 44 less the 18px icon) leaves the X drawn exactly where
            it was, so only the area that answers a tap grows.
          */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.milestoneDismiss}
            className="tap-target -m-[13px] flex shrink-0 items-center justify-center rounded-full text-ink-soft/60 hover:text-ink-soft dark:text-paper/50 dark:hover:text-paper/80"
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
          {/*
            The module and mastery-project titles stay in English in every
            language, so each is isolated as an LTR run too, as the roadmap
            already does with module titles. See titleRuns in
            src/lib/milestones.js.
          */}
          {runs.map((run, i) =>
            run.isolate ? (
              <bdi key={i} dir="ltr">
                {run.text}
              </bdi>
            ) : (
              run.text
            ),
          )}
          {'\n\n'}
          {/*
            The URL and the hashtag are each isolated as their own LTR run, and
            this is not a nicety. Rendered inside the Arabic paragraph the
            hashtag came out as "IAmTheStory_ALX#" — the bidirectional algorithm
            moves a leading # to the visual end of a Latin run in RTL text. The
            STRING was always correct, so what reached LinkedIn was fine; what
            the learner saw looked broken, which is worse than it sounds for the
            one element the whole feature exists to deliver. A bare URL sitting
            in the same paragraph has exactly the same problem.

            <bdi> isolates them without changing a character of the text.

            The URL may also break between any two of its characters, where
            nothing else fits. It has no break a line can take before
            ".../alx-", 273px into it, and so it ran past the grey box at
            375px, and past the screen's edge at 320px: cut off on the right,
            or in Arabic on the left. Wherever ".../alx-" fits, from 414px, it
            still breaks there; and isolated, it reads left to right across
            the lines it takes.
          */}
          <bdi dir="ltr" className="break-words">{url}</bdi>
          {'\n\n'}
          <bdi dir="ltr">{hashtag}</bdi>
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
            onClick={() => void shareCommunity()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-cobalt/40 px-5 text-sm font-semibold text-cobalt-600 transition-colors hover:bg-cobalt/10 dark:border-lime/40 dark:text-lime dark:hover:bg-lime/10"
          >
            <MessagesSquare size={15} aria-hidden="true" />
            {t.milestoneShareCommunity}
          </button>
        </div>

        {/*
          The points note is a line rather than a third button. It is a reason to
          press one of the two above, not an action of its own — and ALX caps
          community posts at ten a month, so it says "earns Legacy Points" rather
          than naming a figure this app cannot verify for a given learner.
        */}
        <p className="mt-3 text-[12px] leading-relaxed text-ink-soft dark:text-paper/60">
          {t.milestonePointsNote}
        </p>

        <div className="mt-4 border-t border-ink/10 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft transition-colors hover:text-ink dark:text-paper/70 dark:hover:text-paper"
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

// What Tab can reach inside the dialogue. Only buttons today; the rest is
// here so a link or a field added later is not skipped by the wrap.
const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab and Shift+Tab inside `box`, wrapping from one end to the other. */
function wrapTab(e, box) {
  const stops = box ? [...box.querySelectorAll(TABBABLE)] : []
  if (stops.length === 0) return
  const first = stops[0]
  const last = stops[stops.length - 1]
  const at = document.activeElement
  const outside = !box.contains(at)
  if (e.shiftKey && (at === first || outside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (at === last || outside)) {
    e.preventDefault()
    first.focus()
  }
}
