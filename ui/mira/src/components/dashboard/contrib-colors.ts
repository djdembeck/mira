// Contribution colour scale, shared by the heatmap and the inline bar gauges so
// intensity reads identically everywhere. Index 0 is "empty", 1→4 ramp from
// light to dark green. The green ramp is FIXED across themes (one palette, no
// `dark:` variant) so the gauges/heatmap don't change colour when the theme
// flips. Only the empty cell adapts, so it blends with the page background
// instead of looking filled.
export const CONTRIB_LEVELS = [
  "bg-[#ebedf0] dark:bg-[#2d333b]",
  "bg-[#9be9a8]",
  "bg-[#40c463]",
  "bg-[#30a14e]",
  "bg-[#216e3a]",
]

// Single solid green for lit gauge bars — magnitude is shown by how many bars
// light up, not by shade, so there's no light-vs-dark "which means more?" doubt.
export const CONTRIB_GAUGE_FILL = "bg-[#2da44e]"

// A faint inset ring gives every square/bar a crisp edge against either
// background — without it, low-intensity cells melt into the page in dark mode.
export const CONTRIB_CELL_RING = "ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]"

/** Map a value to a 1–5 bucket relative to a max (0 stays 0). */
export function contribLevel(value: number, max: number): number {
  if (value <= 0) return 0
  return Math.min(5, Math.max(1, Math.ceil((value / Math.max(max, 1)) * 5)))
}
