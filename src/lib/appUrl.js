/**
 * The app's canonical public address.
 *
 * WHY THIS IS HARDCODED, WHEN CLAUDE.md SAYS NEVER TO HARDCODE THE SUBPATH
 * That rule is about resolving ASSETS at runtime — those must go through
 * `import.meta.env.BASE_URL`, because local dev and preview serve from `/` while
 * CI injects `/alx-pace/`, and a hardcoded path breaks one of the two.
 *
 * This is the opposite problem. It answers "where does this app live on the
 * internet", and the honest answer never varies with where the code happens to
 * be running. Deriving it from `window.location` would put `http://localhost`
 * into a learner's LinkedIn post whenever the post was composed in dev, and into
 * an Open Graph tag that a crawler cannot resolve at all.
 *
 * So: one constant, used by the post text and mirrored by the meta tags in
 * index.html. If the app ever moves, this and those tags change together — and
 * the bridge at the old address keeps handing learners over, exactly as it did
 * for the last move.
 */
export const APP_URL = 'https://alxdataprograms.github.io/alx-pace/'
