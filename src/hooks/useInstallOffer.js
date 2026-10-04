import { useSyncExternalStore } from 'react'
import { installOffer, subscribe } from '../lib/install'

/**
 * The install offer for this browser — 'prompt', 'ios' or null — kept current
 * as Chromium hands over its prompt or the app gets installed. A primitive
 * snapshot, so React re-renders only when the offer actually changes.
 */
export function useInstallOffer() {
  return useSyncExternalStore(subscribe, () => installOffer(), () => null)
}
