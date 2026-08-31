import { describe, it, expect, vi, afterEach } from 'vitest'

import { linkedInComposerUrl, copyToClipboard, shareToLinkedIn } from './share'
import { CAMPAIGN_HASHTAG } from './milestones'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('linkedInComposerUrl', () => {
  it('carries the post text and the hashtag intact', () => {
    const text = `Finished the SQL module.\n\n${CAMPAIGN_HASHTAG}`
    const url = new URL(linkedInComposerUrl(text))

    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/feed/')
    expect(url.searchParams.get('shareActive')).toBe('true')
    // Round-tripped rather than string-matched: what matters is that LinkedIn
    // receives exactly what was shown on screen, newlines and hash included.
    expect(url.searchParams.get('text')).toBe(text)
  })

  it('encodes the hash so it is not read as a fragment', () => {
    // An unencoded # would truncate the URL at the hashtag — the one character
    // this whole feature exists to deliver.
    const url = linkedInComposerUrl(`Done.\n\n${CAMPAIGN_HASHTAG}`)
    expect(url).not.toContain(`#${CAMPAIGN_HASHTAG.slice(1)}`)
    expect(url).toContain('%23IAmTheStory_ALX')
  })

  it('survives accents, dashes and quotes a translated post may contain', () => {
    const text = 'Fini — module 2 sur 4 & « données » #IAmTheStory_ALX'
    expect(new URL(linkedInComposerUrl(text)).searchParams.get('text')).toBe(text)
  })
})

describe('copyToClipboard', () => {
  it('reports success when the clipboard accepts it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyToClipboard('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('returns false rather than throwing when permission is refused', async () => {
    // A rejected clipboard write must not stop the composer opening. An
    // exception out of a click handler would do exactly that.
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
    })
    await expect(copyToClipboard('hello')).resolves.toBe(false)
  })

  it('returns false where there is no clipboard API at all', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyToClipboard('hello')).resolves.toBe(false)
  })
})

describe('shareToLinkedIn', () => {
  it('copies BEFORE opening, because opening takes focus', async () => {
    /*
      The ordering is the whole correctness of this function. window.open moves
      focus to the new tab, and a clipboard write from an unfocused document is
      refused — so opening first breaks the copy in exactly the case the copy
      exists for: the one where prefill did not work and pasting is the only
      way the text arrives.
    */
    const order = []
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation(async () => {
          order.push('copy')
        }),
      },
    })
    const open = vi.fn().mockImplementation(() => {
      order.push('open')
      return {}
    })

    await shareToLinkedIn('post', open)
    expect(order).toEqual(['copy', 'open'])
  })

  it('opens SYNCHRONOUSLY, without waiting for the clipboard', () => {
    /*
      The iOS half of the ordering, and the reason this is not just `await copy;
      open`. Safari on iOS demands window.open inside the gesture that triggered
      it; an await spends the activation and the popup blocker takes the call.

      Asserted by never resolving the clipboard write and checking that open has
      already happened. If someone reintroduces the await, open has not been
      called at this point and this fails — which is the only way to catch it
      without an iPhone, since desktop browsers forgive the delay.
    */
    let releaseTheWrite
    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => new Promise((resolve) => { releaseTheWrite = resolve }) },
    })
    const open = vi.fn().mockReturnValue({})

    shareToLinkedIn('post', open) // deliberately not awaited
    expect(open, 'window.open must fire before the clipboard settles').toHaveBeenCalledOnce()

    releaseTheWrite()
  })

  it('still opens LinkedIn when the copy fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('nope')) },
    })
    const open = vi.fn().mockReturnValue({})

    const result = await shareToLinkedIn('post', open)
    expect(result).toEqual({ copied: false, opened: true })
    expect(open).toHaveBeenCalledOnce()
  })

  it('passes the composer URL, not the bare text', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const open = vi.fn().mockReturnValue({})

    await shareToLinkedIn(`Done.\n\n${CAMPAIGN_HASHTAG}`, open)
    const [url] = open.mock.calls[0]
    expect(url).toContain('linkedin.com/feed/')
    expect(url).toContain('shareActive=true')
    expect(url).toContain('%23IAmTheStory_ALX')
  })

  it('reports opened:false when a popup blocker returns null', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const result = await shareToLinkedIn('post', () => null)
    expect(result).toEqual({ copied: true, opened: false })
  })
})
