/**
 * Handing a finished post to LinkedIn.
 *
 * WHAT IS ACTUALLY POSSIBLE WITHOUT A BACKEND
 * Posting on someone's behalf needs OAuth and the w_member_social scope — a
 * server holding tokens, which would end this app's zero-login premise. So the
 * most that can happen is: open the composer with the text ready, and let the
 * person publish it themselves. That is also the honest shape for a campaign
 * post; nothing is published that they did not look at.
 *
 * THE PREFILL IS UNDOCUMENTED, AND WORKS
 * LinkedIn's current developer documentation contains no credential-free share
 * URL at all — not share-offsite, not shareArticle. The only documented
 * mechanism is a plugin that accepts a URL and nothing else. `shareActive=true`
 * with a `text` parameter appears nowhere in their docs.
 *
 * It was verified by hand against a signed-in account: the composer opened with
 * the full text in place and the campaign hashtag rendered as a live hashtag.
 * That is a real result and worth using — but an undocumented endpoint can stop
 * working without an announcement, which is why the clipboard below is not a
 * nicety. If the prefill dies, the feature degrades to "paste it" rather than
 * to nothing.
 *
 * VERIFIED ON MOBILE, AND HALF OF IT FAILED
 * Tested by hand on a real phone: the composer URL opens the LinkedIn app, but
 * the text does NOT survive that hand-off. The learner lands in LinkedIn with an
 * empty composer and has to tap it and paste. The clipboard was doing all the
 * work, which is why it was written to be load-bearing rather than a nicety.
 *
 * So mobile gets a different route entirely — see nativeShare below.
 */

const LINKEDIN_COMPOSER = 'https://www.linkedin.com/feed/'

/** The composer URL, with the post text carried in the query. */
export function linkedInComposerUrl(text) {
  const params = new URLSearchParams({ shareActive: 'true', text })
  return `${LINKEDIN_COMPOSER}?${params.toString()}`
}

/**
 * Copies text, and says whether it worked.
 *
 * Written synchronously up to the clipboard call for a reason: iOS Safari ties
 * clipboard access to the user gesture, and an `await` before the write can
 * spend the activation the write depends on. Nothing is awaited before it here.
 *
 * Returns false rather than throwing. A failed copy must not stop the composer
 * opening — the person can still type — and an exception thrown out of a click
 * handler would do exactly that.
 */
export async function copyToClipboard(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied permission, no secure context, or the document lost focus.
  }
  return false
}

/**
 * Whether to hand off to the operating system instead of a URL.
 *
 * `navigator.share` alone is the wrong test: macOS Safari has it too, and on
 * desktop the composer URL demonstrably works — prefill and all, verified by
 * hand. Replacing a working desktop flow with a share sheet would be a
 * regression bought with a feature detect.
 *
 * So it is gated on a COARSE POINTER as well: the share sheet is used where
 * the URL prefill was actually observed to fail, and nowhere else. That is a
 * capability query rather than user-agent sniffing, and it degrades the right
 * way — an unknown device keeps the flow that is known to work.
 */
function nativeShareAvailable() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

/**
 * Copy and open, both inside the one user gesture. The ordering is load-bearing
 * in BOTH directions, and getting either wrong breaks a different platform.
 *
 * COPY MUST START BEFORE THE OPEN
 * window.open moves focus to the new tab, and a clipboard write from a document
 * that has lost focus is rejected. Copying afterwards fails in exactly the case
 * the clipboard exists for — the one where the prefill did not work and pasting
 * is the only way the text arrives.
 *
 * THE OPEN MUST NOT WAIT FOR THE COPY TO FINISH
 * This is the half I got wrong first, and it fails on the platform most learners
 * are on. iOS Safari requires window.open to be called synchronously within the
 * gesture that triggered it. `await` yields to the microtask queue, the user
 * activation is spent, and the popup blocker eats the call — so the earlier
 * `await copyToClipboard(text)` before opening meant no LinkedIn at all on an
 * iPhone. Desktop is lenient about this, which is why hand-testing there found
 * nothing.
 *
 * So: START the copy, do not await it, open synchronously, and settle the copy
 * afterwards purely to report status. The write is initiated while the document
 * still has focus; the open still happens inside the activation.
 *
 * NOT REPRODUCED LOCALLY — this Mac has no Xcode, so there is no iOS Simulator
 * to prove it on. The fix is correct on the spec and strictly safer than what it
 * replaces, but somebody should still tap the button on a real iPhone.
 *
 * @returns {Promise<{ copied: boolean, opened: boolean }>}
 */
export function shareToLinkedIn(text, options = {}) {
  const {
    open = (url) => window.open(url, '_blank', 'noopener'),
    share = nativeShareAvailable() ? (data) => navigator.share(data) : null,
  } = options

  // Started first and deliberately not awaited. See above — an await before the
  // open is an iOS bug, and the copy still matters on both routes: on mobile it
  // is the recovery if the share sheet has no LinkedIn on it.
  const copying = copyToClipboard(text)

  if (share) {
    /*
      Called synchronously, inside the gesture, for the same activation reason
      as window.open.

      A cancelled sheet rejects with AbortError. That is not a failure — the
      learner saw the sheet and chose not to post, which is the feature working.
      Anything else is a real failure, and there is no falling back to the URL
      by then: the activation is spent, so window.open would be blocked. Hence
      the narrow gate above rather than a hopeful attempt.
    */
    const sheet = Promise.resolve()
      .then(() => share({ text }))
      .then(
        () => ({ opened: true, dismissed: false }),
        (err) => ({ opened: err?.name === 'AbortError', dismissed: err?.name === 'AbortError' }),
      )
    return Promise.all([copying, sheet]).then(([copied, r]) => ({
      copied,
      opened: r.opened,
      method: 'native',
    }))
  }

  const opened = Boolean(open(linkedInComposerUrl(text)))
  return copying.then((copied) => ({ copied, opened, method: 'composer' }))
}
