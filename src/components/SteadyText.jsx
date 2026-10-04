/**
 * Text that changes during a visit without changing its size.
 *
 * `children` is the wording in force; `texts` every wording it can come to
 * this visit. They share one grid cell, all but the one in force invisible and
 * unread, so the text is as large as the largest from the start. A count that
 * drops with every tick ("14 items" … "1 item"), then gives way to an
 * all-clear, otherwise rewraps its lines now and then, and moves everything
 * below it, the row just ticked among them, out from under the learner's
 * finger. The focus card's next checkpoint holds its line the same way.
 *
 * `inline` for a part of a line, which then takes the width of the widest.
 */
export default function SteadyText({ texts, inline = false, children }) {
  return (
    <span className={inline ? 'inline-grid' : 'grid'}>
      {[...new Set(texts)].map((text) => (
        <span key={text} className="invisible col-start-1 row-start-1" aria-hidden="true">
          {text}
        </span>
      ))}
      <span className="col-start-1 row-start-1">{children}</span>
    </span>
  )
}

/**
 * The counts that set the size of a count dropping from `n` to none: `n`
 * itself, with the most digits; two and one, which Arabic writes out
 * ("عنصران", "عنصر واحد"); and none, the all-clear. Pass each one's wording
 * as SteadyText's `texts`.
 */
export const widestCounts = (n) => [...new Set([n, 2, 1, 0])].filter((k) => k <= n)
