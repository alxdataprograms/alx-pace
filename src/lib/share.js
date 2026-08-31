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
 * NOT VERIFIED ON MOBILE: whether this opens the LinkedIn app and whether the
 * text survives that hand-off. Most learners here are on phones, so treat the
 * clipboard as the load-bearing half until someone checks.
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
 * Copy first, then open. The order is load-bearing.
 *
 * window.open moves focus to the new tab, and a clipboard write from a document
 * that has lost focus is rejected. Opening first and copying afterwards fails
 * in exactly the case the clipboard exists for — the one where the prefill did
 * not work and the paste is the only way the text arrives.
 *
 * @returns {{ copied: boolean, opened: boolean }}
 */
export async function shareToLinkedIn(text, open = (url) => window.open(url, '_blank', 'noopener')) {
  const copied = await copyToClipboard(text)
  const opened = Boolean(open(linkedInComposerUrl(text)))
  return { copied, opened }
}
