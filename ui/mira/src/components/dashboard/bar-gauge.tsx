import { CONTRIB_CELL_RING, CONTRIB_GAUGE_FILL, CONTRIB_LEVELS, contribLevel } from "./contrib-colors"

// Ascending bar heights — a compact signal-strength-style gauge.
const HEIGHTS = ["h-1.5", "h-2", "h-2.5", "h-3", "h-3.5"]

/**
 * A tiny 5-bar gauge. Magnitude is encoded purely by how many bars light up
 * (and their rising height) — every lit bar is the SAME green, so there's no
 * "does light or dark mean more?" ambiguity. Unlit bars use the empty shade.
 */
export function BarGauge({
  value,
  max,
  label,
}: {
  value: number
  max: number
  label?: string
}) {
  const filled = contribLevel(value, max)
  const title = label ?? `${value.toLocaleString()}`
  return (
    <span className="inline-flex items-end gap-0.5" title={title} aria-label={title}>
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-[1px] ${h} ${CONTRIB_CELL_RING} ${
            i < filled ? CONTRIB_GAUGE_FILL : CONTRIB_LEVELS[0]
          }`}
        />
      ))}
    </span>
  )
}
