// SVG trace of the M-Key monogram logo mark.
// Uses a fixed brand-gold fill so it reads well on both light and dark sidebar backgrounds.
// viewBox is tight around the mark content (x: 16–84, y: 2–166).

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="16 2 68 164"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* ── Key bit (two teeth + shaft) ─────────────────────────────────────
          Left edge of shaft: x=43  Right edge of shaft: x=57
          Bit extends right to x=72 with a single notch at y=20–30          */}
      <path
        fill="#f5c842"
        d="M43,4 L72,4 L72,20 L57,20 L57,30 L72,30 L72,47 L57,47 L57,62 L43,62 Z"
      />

      {/* ── Ball at shaft / M junction ──────────────────────────────────── */}
      <circle fill="#f5c842" cx="50" cy="68" r="8" />

      {/* ── Left M arm ──────────────────────────────────────────────────────
          Cubic bezier: starts at ball centre, swings left, ends at the
          leftmost point of the ring outer edge (x=34, y=148).              */}
      <path
        fill="none"
        stroke="#f5c842"
        strokeWidth="11"
        strokeLinecap="butt"
        d="M50,68 C22,90 16,120 34,148"
      />

      {/* ── Right M arm (mirror) ─────────────────────────────────────────── */}
      <path
        fill="none"
        stroke="#f5c842"
        strokeWidth="11"
        strokeLinecap="butt"
        d="M50,68 C78,90 84,120 66,148"
      />

      {/* ── Bottom ring (donut / key bow) ────────────────────────────────────
          Outer circle r=16, inner hole r=7, both centred at (50,148).
          fill-rule=evenodd makes the inner subpath a transparent cutout.   */}
      <path
        fill="#f5c842"
        fillRule="evenodd"
        d="
          M34,148 A16,16 0 1 0 66,148 A16,16 0 1 0 34,148 Z
          M43,148 A7,7  0 1 0 57,148 A7,7  0 1 0 43,148 Z
        "
      />
    </svg>
  )
}
