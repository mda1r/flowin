/* ────────────────────────────────────────────────────────────────
   3D isometric POS illustrations — the login backdrop cast.
   Pure inline SVG, 2:1 isometric projection (every slanted edge
   moves 2px horizontally per 1px vertically), one shared palette:

     top faces     #dbeafe → #eff6ff   (light catches the top)
     lit sides     #60a5fa / #93c5fd   (front-left, toward light)
     shaded sides  #3b82f6 → #1d4ed8   (front-right, away)
     dark hardware #475569 / #334155 / #1e293b / #0f172a
     accent        #4F7EF7  ·  gold #f59e0b  ·  laser #f43f5e

   Light rig (upper-left key light, cool ambient fill):
     · every face gets a gradient, never a flat fill
     · fresnel — thin white strokes trace edges that face the key
     · ambient occlusion — blurred dark pools wherever two bodies
       touch (terminal↔counter, coin↔coin, hand↔counter…)
     · speculars — soft white ellipses/streaks on glass and metal
     · bloom — lit screens leak a blurred copy of their own color
     · grain — one feTurbulence pass fakes matte plastic (kept to
       a single small filter so paint cost stays negligible)
     · DOF — the two layer-1 (far) pieces carry a 0.3px blur +
       slight desaturation baked in; near pieces stay crisp

   Iso text/labels sit on faces via skewY(±26.565°) — atan(1/2) —
   so type lies flat on the projected plane instead of floating.
   Gradient/filter ids are prefixed per component (pt-, ch-, …)
   because all eight render into the same document.
   ──────────────────────────────────────────────────────────────── */

/* organic 6-limb sparkle — concave star with a hot white core */
function Spark({ x, y, s = 1, fill = '#4F7EF7', opacity = 0.6 }: {
  x: number
  y: number
  s?: number
  fill?: string
  opacity?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <path
        d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8 Z"
        fill={fill}
      />
      <path
        d="M0 -3.4 C0.45 -0.9 0.9 -0.45 3.4 0 C0.9 0.45 0.45 0.9 0 3.4 C-0.45 0.9 -0.9 0.45 -3.4 0 C-0.9 -0.45 -0.45 -0.9 0 -3.4 Z"
        fill="#ffffff"
        opacity="0.85"
      />
    </g>
  )
}

/* knurled side ridges along a coin's visible (front) arc */
function CoinKnurl({ cx, cy, h }: { cx: number; cy: number; h: number }) {
  return (
    <g>
      {Array.from({ length: 11 }, (_, i) => {
        const a = ((22 + i * 13.6) * Math.PI) / 180
        const x = cx + 24 * Math.cos(a)
        const y = cy + 12 * Math.sin(a)
        return (
          <line
            key={i}
            x1={x}
            y1={y + 0.6}
            x2={x}
            y2={y + h - 0.4}
            stroke="#7c3d06"
            strokeOpacity="0.3"
            strokeWidth="0.6"
          />
        )
      })}
    </g>
  )
}

/* minting serration — ring of tick marks just inside a coin rim */
function CoinSerration({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {Array.from({ length: 30 }, (_, i) => {
        const a = (i * 12 * Math.PI) / 180
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        return (
          <line
            key={i}
            x1={cx + 23.1 * cos}
            y1={cy + 11.55 * sin}
            x2={cx + 21.3 * cos}
            y2={cy + 10.65 * sin}
            stroke="#c98a0b"
            strokeOpacity="0.55"
            strokeWidth="0.55"
          />
        )
      })}
    </g>
  )
}

/* ───── 1 · POS terminal on a counter — the hero piece ───── */

export function PosTerminalIllus() {
  return (
    <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pt-desk" x1="40" y1="70" x2="170" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f2f7ff" />
          <stop offset="0.55" stopColor="#ddeafd" />
          <stop offset="1" stopColor="#c6dbfa" />
        </linearGradient>
        <linearGradient id="pt-deskL" x1="70" y1="106" x2="70" y2="172" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6faefb" />
          <stop offset="1" stopColor="#4c8df2" />
        </linearGradient>
        <linearGradient id="pt-deskR" x1="160" y1="117" x2="160" y2="172" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d7cf0" />
          <stop offset="1" stopColor="#2d5ecf" />
        </linearGradient>
        <linearGradient id="pt-body" x1="80" y1="82" x2="120" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#55647d" />
          <stop offset="1" stopColor="#3c4a62" />
        </linearGradient>
        <linearGradient id="pt-slabtop" x1="68" y1="24" x2="126" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5d6d87" />
          <stop offset="1" stopColor="#414f66" />
        </linearGradient>
        <linearGradient id="pt-paper" x1="97" y1="15" x2="97" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.72" stopColor="#f4f7fd" />
          <stop offset="1" stopColor="#efe9da" />
        </linearGradient>
        <linearGradient id="pt-card" x1="143" y1="88" x2="153" y2="103" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8ab5fc" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="pt-metal" x1="138" y1="98" x2="162" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#94a8c2" />
          <stop offset="0.5" stopColor="#67799a" />
          <stop offset="1" stopColor="#556685" />
        </linearGradient>
        <filter id="pt-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="pt-soft2" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="pt-soft3" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="pt-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"
            result="wn"
          />
          <feComposite in="wn" in2="SourceAlpha" operator="in" />
        </filter>
        <clipPath id="pt-topclip">
          <polygon points="18,106 98,66 200,117 120,157" />
        </clipPath>
        <clipPath id="pt-screenclip">
          <rect x="5" y="-39" width="42" height="26" rx="2.5" />
        </clipPath>
      </defs>

      {/* ground shadow — wide ambient pool + tighter dark core */}
      <ellipse cx="110" cy="164" rx="84" ry="8" fill="#1e3a8a" opacity="0.13" filter="url(#pt-soft)" />
      <ellipse cx="110" cy="163" rx="56" ry="5.5" fill="#0f2a6e" opacity="0.18" filter="url(#pt-soft2)" />

      {/* counter — light top, lit left flank, shaded right flank */}
      <polygon points="18,106 120,157 120,170 18,119" fill="url(#pt-deskL)" />
      <polygon points="120,157 200,117 200,130 120,170" fill="url(#pt-deskR)" />
      <polyline points="18,119 120,170 200,130" stroke="#1b3fa0" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <polygon points="18,106 98,66 200,117 120,157" fill="url(#pt-desk)" />

      {/* faint iso grid gives the surface scale */}
      <g clipPath="url(#pt-topclip)">
        <g transform="matrix(1 -0.5 1 0.5 18 106)">
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(i + 1) * 10}
              y1="0"
              x2={(i + 1) * 10}
              y2="102"
              stroke="#1e4fd8"
              strokeOpacity="0.06"
              strokeWidth="0.7"
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={(i + 1) * 12}
              x2="80"
              y2={(i + 1) * 12}
              stroke="#1e4fd8"
              strokeOpacity="0.06"
              strokeWidth="0.7"
            />
          ))}
        </g>
        {/* soft sheen pooling near the back corner + crisp streak */}
        <ellipse cx="102" cy="86" rx="32" ry="11" fill="#ffffff" opacity="0.16" filter="url(#pt-soft)" />
        <polygon points="46,101 64,92 96,108 78,117" fill="#ffffff" opacity="0.05" />
        {/* blurred reflection of the terminal on the glossy top */}
        <polygon points="80,101 128,77 133,88 85,112" fill="#16337a" opacity="0.07" filter="url(#pt-soft2)" />
      </g>

      {/* fresnel edges — bright where the key light rakes */}
      <polyline points="18,106 98,66 200,117" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <polyline points="18,106 120,157 200,117" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.5" strokeLinejoin="round" fill="none" />

      {/* screen light pooling on the counter */}
      <ellipse cx="124" cy="116" rx="38" ry="13" fill="#4F7EF7" opacity="0.18" filter="url(#pt-soft)" />
      <ellipse cx="120" cy="113" rx="20" ry="7" fill="#6f9bff" opacity="0.2" filter="url(#pt-soft2)" />

      {/* contact shadow — the terminal grounds itself on the counter */}
      <ellipse cx="99" cy="110" rx="40" ry="12" fill="#0a1e46" opacity="0.26" filter="url(#pt-soft2)" />
      <ellipse cx="99" cy="109" rx="30" ry="8" fill="#0a1e46" opacity="0.24" filter="url(#pt-soft3)" />

      {/* terminal base — matte plastic (gradient + grain) */}
      <polygon points="66,96 104,115 104,122 66,103" fill="#334155" />
      <polygon points="104,115 134,100 134,107 104,122" fill="#1e293b" />
      <polygon points="66,96 96,81 134,100 104,115" fill="url(#pt-body)" />
      <polygon points="66,96 96,81 134,100 104,115" fill="#ffffff" filter="url(#pt-grain)" />
      <polygon points="66,96 104,115 104,122 66,103" fill="#ffffff" filter="url(#pt-grain)" />
      <polyline points="66,96 96,81 134,100" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.8" strokeLinejoin="round" fill="none" />

      {/* neck joining base to display + its occlusion pool */}
      <polygon points="94,94 110,86 110,74 94,82" fill="#334155" />
      <g transform="rotate(-26.565 102 91.5)">
        <ellipse cx="102" cy="91.5" rx="9" ry="2.6" fill="#0a1628" opacity="0.3" filter="url(#pt-soft3)" />
      </g>

      {/* display slab — dark side, lit top edge */}
      <polygon points="74,97 74,53 68,50 68,94" fill="#0f172a" />
      <polygon points="74,53 126,27 120,24 68,50" fill="url(#pt-slabtop)" />
      <polyline points="68,50 120,24" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />

      {/* receipt printer slot + paper curling out */}
      <polygon points="84,46 112,32 109,30.5 81,44.5" fill="#020617" />
      <polygon points="88,42 106,33 106,15 88,24" fill="url(#pt-paper)" />
      {/* rolled lip — the underside shows as the paper curls forward */}
      <path d="M88 26.8 Q93 23.7 98.2 20.9 Q102.5 18.6 106 18.8 L106 20.4 Q102.5 20.2 98.6 22.4 Q93.5 25.2 88 28.4 Z" fill="#24479f" opacity="0.12" />
      <path d="M88 24 Q95 20.2 100 17.6 Q103.5 15.8 106 15.6 L106 18.8 Q102.5 18.6 98.2 20.9 Q93 23.7 88 26.8 Z" fill="#d7e2f2" />
      <line x1="88" y1="24" x2="106" y2="15" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.7" />
      <g transform="translate(88 42) skewY(-26.565)">
        <line x1="3" y1="-14" x2="15" y2="-14" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-10" x2="12" y2="-10" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-6" x2="14" y2="-6" stroke="#4F7EF7" strokeOpacity="0.6" strokeWidth="1.4" />
      </g>

      {/* screen face: bezel, glass, scanlines, bloom, chroma-split total */}
      <polygon points="74,97 126,71 126,27 74,53" fill="#1e293b" />
      <line x1="74" y1="97" x2="126" y2="71" stroke="#4F7EF7" strokeOpacity="0.25" strokeWidth="1" />
      <g transform="translate(74 97) skewY(-26.565)">
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="#0b1526" />
        <ellipse cx="26" cy="-26" rx="16" ry="6" fill="#4F7EF7" opacity="0.3" filter="url(#pt-soft2)" />
        {/* CRT-ish scanlines, 2px pitch */}
        <g clipPath="url(#pt-screenclip)">
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1="5.4"
              y1={-37.4 + i * 2}
              x2="46.6"
              y2={-37.4 + i * 2}
              stroke="#ffffff"
              strokeOpacity="0.03"
              strokeWidth="0.6"
            />
          ))}
          {/* diagonal glass reflections */}
          <polygon points="13,-39 21,-39 9,-13 1,-13" fill="#ffffff" opacity="0.06" />
          <polygon points="24.5,-39 28,-39 16,-13 12.5,-13" fill="#ffffff" opacity="0.045" />
        </g>
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="none" stroke="#4F7EF7" strokeOpacity="0.4" strokeWidth="0.8" />
        {/* status row */}
        <circle cx="8.6" cy="-36.4" r="0.9" fill="#62E6C7" />
        <rect x="40.5" y="-37" width="4" height="1.1" rx="0.55" fill="#64748b" />
        <text x="26" y="-31.5" textAnchor="middle" fontSize="4.6" fill="#7c8db1">
          الإجمالي
        </text>
        {/* bloom behind the total, then a chromatic split under it */}
        <ellipse cx="26" cy="-24.5" rx="15" ry="5" fill="#4F7EF7" opacity="0.45" filter="url(#pt-soft2)" />
        <text x="25.55" y="-21.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#ff6b6b" opacity="0.4">
          SAR ٤٥٠
        </text>
        <text x="26.45" y="-21.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#4fc3ff" opacity="0.4">
          SAR ٤٥٠
        </text>
        <text x="26" y="-21.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#b6ccff">
          SAR ٤٥٠
        </text>
        {/* keypad — each key catches a sliver of light on top */}
        {[
          [6, -10],
          [17, -10],
          [28, -10],
          [39, -10],
          [6, -5.5],
          [17, -5.5],
          [28, -5.5],
        ].map(([kx, ky]) => (
          <g key={`k${kx}-${ky}`}>
            <rect x={kx} y={ky} width="8" height="3" rx="1" fill="#31405a" />
            <line x1={kx + 1} y1={ky + 0.6} x2={kx + 7} y2={ky + 0.6} stroke="#ffffff" strokeOpacity="0.15" strokeWidth="0.5" />
          </g>
        ))}
        <rect x="39" y="-5.5" width="8" height="3" rx="1" fill="#4F7EF7" />
        <line x1="40" y1="-4.9" x2="46" y2="-4.9" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.5" />
      </g>

      {/* card reader — brushed metal top, card mid-swipe */}
      <ellipse cx="150" cy="118.5" rx="16" ry="5" fill="#0a1e46" opacity="0.25" filter="url(#pt-soft3)" />
      <polygon points="138,104 150,110 150,120 138,114" fill="#475569" />
      <polygon points="150,110 162,104 162,114 150,120" fill="#334155" />
      <polygon points="138,104 150,98 162,104 150,110" fill="url(#pt-metal)" />
      <polyline points="138,104 150,98 162,104" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.8" strokeLinejoin="round" fill="none" />
      <polygon points="143,103 153,98 153,88 143,93" fill="url(#pt-card)" />
      <line x1="143" y1="90.5" x2="153" y2="85.5" stroke="#dbeafe" strokeWidth="1.5" strokeOpacity="0.9" />
      <line x1="143.4" y1="101.8" x2="152.6" y2="97.2" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="0.8" />
      <polygon points="142,104.5 152,99.5 154.4,100.7 144.4,105.7" fill="#0f172a" />

      {/* stylus resting on the counter */}
      <g transform="rotate(26.565 156 133.5)">
        <ellipse cx="156" cy="135" rx="10" ry="2" fill="#16337a" opacity="0.2" filter="url(#pt-soft3)" />
      </g>
      <line x1="147" y1="128.5" x2="165" y2="137.5" stroke="#1f2c40" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="148" y1="128.2" x2="164" y2="136.2" stroke="#8ea2bd" strokeOpacity="0.8" strokeWidth="0.7" strokeLinecap="round" />
      <polygon points="164.8,136.1 168.4,139.2 165,138.9" fill="#9fb0c8" />

      {/* ambient sparks — far one softened for depth of field */}
      <Spark x={52} y={34} s={0.85} opacity={0.6} />
      <g filter="url(#pt-soft3)">
        <Spark x={182} y={80} s={0.6} opacity={0.4} />
      </g>
      <circle cx="36" cy="58" r="1" fill="#4F7EF7" opacity="0.3" />
      <circle cx="196" cy="98" r="1.1" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}

/* ───── 2 · the cashier — friendly geometric character at the till ───── */

export function CashierIllus() {
  return (
    <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ch-face" cx="0.44" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#ffe4c6" />
          <stop offset="0.55" stopColor="#fbcf9f" />
          <stop offset="1" stopColor="#edb07c" />
        </radialGradient>
        <radialGradient id="ch-hand" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffd3a9" />
          <stop offset="1" stopColor="#f0ad7d" />
        </radialGradient>
        <linearGradient id="ch-hair" x1="80" y1="24" x2="80" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e4061" />
          <stop offset="1" stopColor="#1c2942" />
        </linearGradient>
        <linearGradient id="ch-shirt" x1="58" y1="72" x2="102" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6493fb" />
          <stop offset="0.55" stopColor="#476fee" />
          <stop offset="1" stopColor="#3a5fd8" />
        </linearGradient>
        <linearGradient id="ch-counter" x1="40" y1="108" x2="120" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0f6ff" />
          <stop offset="0.55" stopColor="#dcebfd" />
          <stop offset="1" stopColor="#c7ddfb" />
        </linearGradient>
        <linearGradient id="ch-counterL" x1="45" y1="138" x2="45" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6aa9fb" />
          <stop offset="1" stopColor="#4a85ef" />
        </linearGradient>
        <linearGradient id="ch-counterR" x1="115" y1="138" x2="115" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3f7bf1" />
          <stop offset="1" stopColor="#2c5ccf" />
        </linearGradient>
        <filter id="ch-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <filter id="ch-soft2" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="ch-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <clipPath id="ch-topclip">
          <polygon points="10,138 80,103 150,138 80,173" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="80" cy="190" rx="62" ry="6.5" fill="#1e3a8a" opacity="0.13" filter="url(#ch-soft)" />
      <ellipse cx="80" cy="189" rx="42" ry="4.5" fill="#0f2a6e" opacity="0.18" filter="url(#ch-soft2)" />

      {/* resting arm (behind torso), palm settling on the counter rim */}
      <path d="M60 88 Q46 98 49 112" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M61 87 Q49.5 95.5 51 107" stroke="#6d99ff" strokeWidth="3" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      <circle cx="49.5" cy="113" r="5.2" fill="url(#ch-hand)" />

      {/* neck + the chin's warm occlusion */}
      <rect x="74.5" y="61" width="11" height="12" rx="3.5" fill="#efae7d" />
      <ellipse cx="80" cy="69.4" rx="5.6" ry="1.9" fill="#c47b4e" opacity="0.55" />

      {/* torso — blue uniform: side shade, shoulder light, cloth folds */}
      <rect x="53" y="70" width="54" height="56" rx="17" fill="url(#ch-shirt)" />
      <path d="M104.5 84 Q107.5 100 102.5 118" stroke="#2b4fc0" strokeWidth="4.5" strokeOpacity="0.22" strokeLinecap="round" fill="none" />
      <path d="M56.5 84 Q54 100 58 116" stroke="#8fb0ff" strokeWidth="4" strokeOpacity="0.22" strokeLinecap="round" fill="none" />
      <path d="M60 76 Q68 71 78 70.6" stroke="#ffffff" strokeWidth="3.5" strokeOpacity="0.16" strokeLinecap="round" fill="none" />
      <path d="M63 95 Q68 100 66.5 112" stroke="#2c53c9" strokeWidth="1.8" strokeOpacity="0.35" strokeLinecap="round" fill="none" />
      <path d="M95 92 Q91.5 102 94.5 113" stroke="#2c53c9" strokeWidth="1.8" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      {/* collar + under-collar shadow */}
      <path d="M71 71 L80 82 L89 71 Z" fill="#dbeafe" opacity="0.95" />
      <path d="M71.5 72 L80 83.2 L88.5 72" stroke="#2b4fc0" strokeOpacity="0.3" strokeWidth="1.2" fill="none" />
      {/* name badge */}
      <rect x="87" y="88" width="11" height="7" rx="2" fill="#eff6ff" />
      <rect x="89" y="90.3" width="7" height="1.6" rx="0.8" fill="#4F7EF7" opacity="0.8" />
      <rect x="89" y="92.6" width="4.5" height="1.1" rx="0.55" fill="#94a3b8" opacity="0.8" />

      {/* head — ears, sculpted face, layered hair */}
      <circle cx="57" cy="48" r="4" fill="#f3b482" />
      <circle cx="103" cy="48" r="4" fill="#f3b482" />
      <circle cx="56.6" cy="48.6" r="1.5" fill="#d9905c" opacity="0.6" />
      <circle cx="103.4" cy="48.6" r="1.5" fill="#d9905c" opacity="0.6" />
      <rect x="58" y="26" width="44" height="42" rx="15" fill="url(#ch-face)" />
      {/* temple + jaw shading round the skull */}
      <ellipse cx="61.8" cy="51" rx="2.2" ry="4.6" fill="#e09a66" opacity="0.28" filter="url(#ch-soft1)" />
      <ellipse cx="98.2" cy="51" rx="2.2" ry="4.6" fill="#e09a66" opacity="0.28" filter="url(#ch-soft1)" />
      <ellipse cx="80" cy="63.8" rx="15" ry="3.8" fill="#e09a66" opacity="0.25" filter="url(#ch-soft1)" />
      {/* soft shadow the fringe throws on the forehead */}
      <path d="M58 42 Q66 36.8 80 36.8 Q94 36.8 102 42 Q94 40.2 80 40.2 Q66 40.2 58 42 Z" fill="#d99c68" opacity="0.25" />
      {/* hair — dark base, highlight sweep, loose strands */}
      <path d="M58 42 L58 37 Q58 24 74 24 L86 24 Q102 24 102 37 L102 42 Q94 36.5 80 36.5 Q66 36.5 58 42 Z" fill="url(#ch-hair)" />
      {/* crown sheen hugging the top curve — volume without a hat-band */}
      <path d="M63.5 28.2 Q69 24.9 78 24.8 Q85 24.8 89.5 26.4 Q81 26.4 73.5 27.5 Q67 28.6 63.5 28.2 Z" fill="#5a76a8" opacity="0.6" />
      <path d="M65.5 30.5 Q72 27.2 81 27.4" stroke="#4c6698" strokeWidth="1.1" strokeOpacity="0.6" strokeLinecap="round" fill="none" />
      <path d="M87.5 27.4 Q92 28.4 95.5 30.6" stroke="#16223a" strokeWidth="0.9" strokeOpacity="0.6" strokeLinecap="round" fill="none" />
      {/* brows */}
      <path d="M67.5 43.5 Q71 41.8 74.5 43.3" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M85.5 43.3 Q89 41.8 92.5 43.5" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* eyes — warm iris, pupil, twin catchlights */}
      <circle cx="71" cy="49" r="3" fill="#6b4423" />
      <circle cx="89" cy="49" r="3" fill="#6b4423" />
      <circle cx="71" cy="49" r="1.5" fill="#141c30" />
      <circle cx="89" cy="49" r="1.5" fill="#141c30" />
      <circle cx="70" cy="47.9" r="0.95" fill="#ffffff" opacity="0.95" />
      <circle cx="88" cy="47.9" r="0.95" fill="#ffffff" opacity="0.95" />
      <circle cx="72.2" cy="50.2" r="0.5" fill="#ffffff" opacity="0.55" />
      <circle cx="90.2" cy="50.2" r="0.5" fill="#ffffff" opacity="0.55" />
      {/* nose, blush, smile */}
      <path d="M79.6 50.5 Q81.4 53.2 79.8 54.8" stroke="#e2a678" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="65.5" cy="55" r="2.8" fill="#fb923c" opacity="0.3" filter="url(#ch-soft1)" />
      <circle cx="94.5" cy="55" r="2.8" fill="#fb923c" opacity="0.3" filter="url(#ch-soft1)" />
      <path d="M74 57 Q80 62.5 86 57" stroke="#24334a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M77 60.8 Q80 62.3 83 60.8" stroke="#d98d5f" strokeWidth="1" strokeOpacity="0.55" strokeLinecap="round" fill="none" />

      {/* checkout counter */}
      <polygon points="10,138 80,173 80,195 10,160" fill="url(#ch-counterL)" />
      <polygon points="80,173 150,138 150,160 80,195" fill="url(#ch-counterR)" />
      <polygon points="10,138 80,103 150,138 80,173" fill="url(#ch-counter)" />
      {/* torso's soft shadow falling onto the counter top */}
      <g clipPath="url(#ch-topclip)">
        <ellipse cx="80" cy="111.5" rx="23" ry="7" fill="#16337a" opacity="0.14" filter="url(#ch-soft2)" />
        <polygon points="52,124 72,114 96,126 76,136" fill="#ffffff" opacity="0.08" />
      </g>
      <polyline points="10,138 80,103 150,138" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <polyline points="10,138 80,173 150,138" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      {/* panel detailing + handles on the lit flank */}
      <g transform="translate(10 138) skewY(26.565)">
        <rect x="7" y="6" width="26" height="12" rx="2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
        <rect x="37" y="6" width="26" height="12" rx="2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
        <rect x="17" y="10.6" width="6" height="1.5" rx="0.75" fill="#ffffff" opacity="0.3" />
        <rect x="47" y="10.6" width="6" height="1.5" rx="0.75" fill="#ffffff" opacity="0.3" />
      </g>

      {/* far-hand fingertips draping over the rim */}
      <g transform="rotate(-18 49.5 114)">
        <rect x="45.8" y="112.5" width="1.9" height="4.6" rx="0.95" fill="#f7bb90" />
        <rect x="48.4" y="113.1" width="1.9" height="4.9" rx="0.95" fill="#f7bb90" />
        <rect x="51" y="112.7" width="1.9" height="4.4" rx="0.95" fill="#f7bb90" />
      </g>
      <g clipPath="url(#ch-topclip)">
        <ellipse cx="50" cy="118.8" rx="4.5" ry="1.4" fill="#12295e" opacity="0.25" filter="url(#ch-soft1)" />
      </g>

      {/* flatbed scanner window set into the counter top */}
      <g transform="matrix(1 -0.5 1 0.5 10 138)">
        <rect x="13.4" y="33.4" width="17.2" height="12.2" rx="1.2" fill="#9fb6da" />
        <line x1="13.8" y1="33.9" x2="30.2" y2="33.9" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.5" />
        <rect x="14.6" y="34.6" width="14.8" height="9.8" rx="0.8" fill="#101c33" />
        <line x1="16.5" y1="35.4" x2="19.5" y2="43.6" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2" />
        <line x1="15.2" y1="39.5" x2="29.2" y2="39.5" stroke="#f43f5e" strokeWidth="2.2" strokeOpacity="0.4" filter="url(#ch-soft1)" />
        <line x1="15.2" y1="39.5" x2="29.2" y2="39.5" stroke="#f43f5e" strokeWidth="0.9" strokeOpacity="0.9" />
      </g>

      {/* a small product waiting by the scanner */}
      <ellipse cx="52" cy="144.5" rx="9" ry="2.6" fill="#16337a" opacity="0.2" filter="url(#ch-soft1)" />
      <polygon points="44,132 52,136 52,144 44,140" fill="#63a6fb" />
      <polygon points="52,136 60,132 60,140 52,144" fill="#3b82f6" />
      <polygon points="44,132 52,128 60,132 52,136" fill="#e2eefe" />
      <polygon points="52,137.2 60,133.2 60,135.6 52,139.6" fill="#f59e0b" opacity="0.85" />
      <polyline points="44,132 52,128 60,132" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />

      {/* mini register on the counter */}
      <ellipse cx="118" cy="143" rx="15" ry="4.5" fill="#0a1e46" opacity="0.22" filter="url(#ch-soft2)" />
      <polygon points="106,127 120,120 120,111 106,118" fill="#0f172a" />
      <line x1="109" y1="121.5" x2="117" y2="117.5" stroke="#62E6C7" strokeWidth="3" strokeOpacity="0.4" filter="url(#ch-soft1)" />
      <line x1="109" y1="121.5" x2="117" y2="117.5" stroke="#62E6C7" strokeWidth="1.6" strokeOpacity="0.95" />
      <polygon points="104,130 118,137 118,146 104,139" fill="#334155" />
      <polygon points="118,137 132,130 132,139 118,146" fill="#1e293b" />
      <polygon points="104,130 118,123 132,130 118,137" fill="#475569" />
      <polyline points="104,130 118,123 132,130" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" fill="none" />
      <g transform="translate(104 130) skewY(26.565)">
        <rect x="2.5" y="2.8" width="3" height="1.7" rx="0.5" fill="#1e2b40" />
        <rect x="6.5" y="2.8" width="3" height="1.7" rx="0.5" fill="#1e2b40" />
        <rect x="10.5" y="2.8" width="3" height="1.7" rx="0.5" fill="#1e2b40" />
        <rect x="2.5" y="5.4" width="3" height="1.7" rx="0.5" fill="#1e2b40" />
        <rect x="6.5" y="5.4" width="3" height="1.7" rx="0.5" fill="#1e2b40" />
        <rect x="10.5" y="5.4" width="3" height="1.7" rx="0.5" fill="#4F7EF7" />
      </g>

      {/* extended arm ringing up the sale — fingers on the keys */}
      <ellipse cx="120.5" cy="131.5" rx="6" ry="2" fill="#0a1e46" opacity="0.3" filter="url(#ch-soft1)" />
      <path d="M98 84 Q114 94 119 124" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M99 84.5 Q112 92.5 117 112" stroke="#6d99ff" strokeWidth="3" strokeOpacity="0.32" strokeLinecap="round" fill="none" />
      <circle cx="119.5" cy="126" r="5.4" fill="url(#ch-hand)" />
      <g transform="rotate(24 119.5 126)">
        <rect x="116.6" y="129.2" width="2" height="4.8" rx="1" fill="#f7bb90" />
        <rect x="119.1" y="129.6" width="2" height="5" rx="1" fill="#f7bb90" />
        <rect x="121.6" y="129.2" width="2" height="4.6" rx="1" fill="#f7bb90" />
      </g>

      {/* ambient sparks */}
      <Spark x={16} y={58} s={0.55} opacity={0.42} />
      <Spark x={146} y={72} s={0.5} opacity={0.32} />
      <circle cx="150" cy="118" r="1" fill="#ffffff" opacity="0.4" />
    </svg>
  )
}

/* ───── 3 · drifting receipt — deep curl, thermal warmth, zig-zag tear ───── */

export function ReceiptIllus() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rc-paper" x1="24" y1="16" x2="66" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9f0fb" />
        </linearGradient>
        {/* thermal paper picks up a cream warmth toward the tail */}
        <linearGradient id="rc-warm" x1="44" y1="16" x2="44" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7ecd8" stopOpacity="0" />
          <stop offset="0.6" stopColor="#f7ecd8" stopOpacity="0" />
          <stop offset="1" stopColor="#efdec0" stopOpacity="0.5" />
        </linearGradient>
        {/* lateral shade — the strip bows, edges fall off the light */}
        <linearGradient id="rc-shade" x1="22" y1="55" x2="66" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#24479f" stopOpacity="0.08" />
          <stop offset="0.16" stopColor="#24479f" stopOpacity="0" />
          <stop offset="0.82" stopColor="#24479f" stopOpacity="0" />
          <stop offset="1" stopColor="#24479f" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="rc-curlin" x1="22" y1="0" x2="22" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a9bad3" />
          <stop offset="1" stopColor="#dde6f3" />
        </linearGradient>
        <linearGradient id="rc-curlout" x1="30" y1="0" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fbff" />
          <stop offset="1" stopColor="#d9e4f4" />
        </linearGradient>
        <filter id="rc-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="rc-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        {/* layer-1 depth of field: a touch soft, a touch desaturated */}
        <filter id="rc-dof" x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix type="saturate" values="0.88" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      <g filter="url(#rc-dof)">
        {/* floated drop shadow */}
        <path
          d="M24.5 22.5 Q42.5 14.5 62.5 16.5 L68.5 100.5 L62 107 L55.5 102.8 L49 108.5 L42.5 104.2 L36 110 L29.5 105.5 Z"
          fill="#1e3a8a"
          opacity="0.1"
          filter="url(#rc-soft)"
        />

        {/* paper strip with torn bottom edge */}
        <path
          d="M22 19 Q40 11 60 13 L66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102 Z"
          fill="url(#rc-paper)"
        />
        <path
          d="M22 19 Q40 11 60 13 L66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102 Z"
          fill="url(#rc-warm)"
        />
        <path
          d="M22 19 Q40 11 60 13 L66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102 Z"
          fill="url(#rc-shade)"
        />
        {/* crisp cut along the tear */}
        <path
          d="M66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102"
          stroke="#b9c7db"
          strokeWidth="0.8"
          strokeOpacity="0.6"
          fill="none"
        />

        {/* the curl — underside roll, lit outer lip, self-cast shadow */}
        <path d="M22.5 18.8 Q26.5 20.6 30.5 19.4 Q27 22.4 23 21.4 Z" fill="#24479f" opacity="0.14" filter="url(#rc-soft1)" />
        <g transform="translate(22 19) scale(0.82) translate(-22 -19)">
          <path
            d="M22 19 Q12.5 12.5 14 5 Q15.5 -1.8 24.5 -0.8 Q31.5 0 30.8 6.2 Q30.2 11 26 16.6 Q24 18.2 22 19 Z"
            fill="url(#rc-curlin)"
          />
          <path
            d="M24.5 -0.8 Q31.5 0 30.8 6.2 Q30.2 11 26 16.6 Q28.6 10.4 28.3 5.4 Q28 0.9 22.8 0.3 Q23.6 -0.5 24.5 -0.8 Z"
            fill="url(#rc-curlout)"
          />
          <path d="M17.5 6.8 Q18 2.6 22.5 1.7" stroke="#8fa3c2" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" fill="none" />
          <path d="M15.6 7.6 Q15.2 1.8 21.5 0.2" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" strokeLinecap="round" fill="none" />
        </g>

        {/* printed content, tilted with the strip */}
        <g transform="rotate(-7 44 55)">
          <circle cx="33" cy="30" r="4.5" stroke="#4F7EF7" strokeWidth="2.6" fill="none" />
          <rect x="40.5" y="24.5" width="3.6" height="11" rx="1.8" fill="#4F7EF7" />
          <circle cx="46.5" cy="34" r="1.2" fill="#f59e0b" opacity="0.9" />
          <rect x="26" y="44" width="28" height="3" rx="1.5" fill="#c3d0e2" />
          <rect x="55" y="44" width="6" height="3" rx="1.5" fill="#9fb2cc" />
          <rect x="26" y="51" width="20" height="3" rx="1.5" fill="#c3d0e2" />
          <rect x="55" y="51" width="6" height="3" rx="1.5" fill="#9fb2cc" />
          <rect x="26" y="58" width="24" height="3" rx="1.5" fill="#c3d0e2" />
          <rect x="55" y="58" width="6" height="3" rx="1.5" fill="#9fb2cc" />
          <line x1="26" y1="67" x2="61" y2="67" stroke="#dbe3f0" strokeWidth="1.4" strokeDasharray="3 2.5" />
          <rect x="26" y="72" width="14" height="4" rx="2" fill="#64748b" />
          <rect x="49" y="72" width="12" height="4" rx="2" fill="#4F7EF7" />
          <rect x="26" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="29" y="84" width="2.6" height="12" fill="#334155" />
          <rect x="33" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="36.5" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="39.5" y="84" width="2.6" height="12" fill="#334155" />
          <rect x="44" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="47" y="84" width="2.6" height="12" fill="#334155" />
          <rect x="51" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="54" y="84" width="1.6" height="12" fill="#334155" />
          <rect x="57" y="84" width="2.6" height="12" fill="#334155" />
        </g>

        <Spark x={14} y={48} s={0.6} opacity={0.5} />
        <circle cx="68" cy="30" r="1" fill="#4F7EF7" opacity="0.35" />
      </g>
    </svg>
  )
}

/* ───── 4 · credit card lying at an isometric angle ─────
   The card face lives inside matrix(1,-0.5,1,0.5,…): local x → the
   (2,-1) iso axis, local y → (2,1). Everything drawn inside — chip,
   embossing, number blocks — lands on the card plane automatically. */

export function CreditCardIllus() {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cc-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cb0fd" />
          <stop offset="0.5" stopColor="#4b86f4" />
          <stop offset="1" stopColor="#2a60dd" />
        </linearGradient>
        <linearGradient id="cc-edge" x1="56" y1="34" x2="56" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c58c8" />
          <stop offset="1" stopColor="#14297a" />
        </linearGradient>
        <linearGradient id="cc-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.55" stopColor="#f5b93a" />
          <stop offset="1" stopColor="#e08c07" />
        </linearGradient>
        {/* holographic patch — rainbow shimmer, not just white */}
        <linearGradient id="cc-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9ad5" />
          <stop offset="0.33" stopColor="#ffd36e" />
          <stop offset="0.63" stopColor="#86f7c5" />
          <stop offset="1" stopColor="#6ea8ff" />
        </linearGradient>
        <linearGradient id="cc-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="cc-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="cc-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <clipPath id="cc-cardclip">
          <rect width="56" height="36" rx="5" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="58" cy="70" rx="42" ry="5.5" fill="#1e3a8a" opacity="0.14" filter="url(#cc-soft)" />
      <ellipse cx="60" cy="69.5" rx="30" ry="3.6" fill="#12276b" opacity="0.2" filter="url(#cc-soft1)" />

      {/* card thickness with a vertical falloff */}
      <path d="M14 44 L42 58 Q46 60.5 50 58 L98 34 L98 39.5 L50 63.5 Q46 66 42 63.5 L14 49.5 Z" fill="url(#cc-edge)" />

      {/* card face on the iso plane */}
      <g transform="matrix(1 -0.5 1 0.5 10 42)">
        <rect width="56" height="36" rx="5" fill="url(#cc-face)" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.6" />
        <g clipPath="url(#cc-cardclip)">
          {/* fintech card art — oversized ghost arcs */}
          <circle cx="55" cy="32" r="16" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="6" fill="none" />
          <circle cx="2" cy="3" r="11" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="5" fill="none" />
          {/* frosted glass layer + soft diagonal light band */}
          <rect width="56" height="36" rx="5" fill="#ffffff" opacity="0.04" />
          <path d="M34 0 L44 0 L28 36 L18 36 Z" fill="#ffffff" opacity="0.08" filter="url(#cc-soft1)" />
          <path d="M20 0 h10 l-13 36 h-10 Z" fill="url(#cc-sheen)" />
        </g>
        {/* fresnel — the two edges facing the key light */}
        <path d="M5 0.4 L51 0.4" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M0.4 5 L0.4 31" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" strokeLinecap="round" />
        <rect x="1" y="1" width="54" height="34" rx="4.2" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="0.5" fill="none" />
        {/* chip with bevel + contact grid */}
        <rect x="6" y="7" width="9" height="7" rx="1.5" fill="url(#cc-chip)" />
        <rect x="6" y="7" width="9" height="7" rx="1.5" stroke="#92610a" strokeOpacity="0.6" strokeWidth="0.4" fill="none" />
        <path d="M6 10.5 h9 M10.5 7 v7" stroke="#b45309" strokeWidth="0.5" opacity="0.7" />
        <line x1="6.6" y1="7.5" x2="14.4" y2="7.5" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.5" />
        {/* contactless */}
        <path d="M22 8.5 a3.8 3.8 0 0 1 0 7.6" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" fill="none" />
        <path d="M24.3 10.4 a1.9 1.9 0 0 1 0 3.8" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" fill="none" />
        {/* holo */}
        <rect x="45" y="4.5" width="8.5" height="7" rx="1.2" fill="url(#cc-rainbow)" opacity="0.9" />
        <rect x="45" y="4.5" width="8.5" height="7" rx="1.2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.4" fill="none" />
        <ellipse cx="47.7" cy="6.5" rx="1.4" ry="0.9" fill="#ffffff" opacity="0.75" />
        <text x="21" y="25" textAnchor="middle" fontSize="6.5" fontWeight="800" letterSpacing="1.1" fill="#ffffff" opacity="0.95">
          FLOWIN
        </text>
        {/* four blocks of four digits — embossed (shadow + face) */}
        {[6, 17.5, 29, 40.5].map((gx) =>
          [0, 2.7, 5.4, 8.1].map((dx) => (
            <g key={`${gx}-${dx}`}>
              <rect x={gx + dx} y="28.45" width="2" height="2" rx="0.5" fill="#1c3f9c" opacity="0.6" />
              <rect x={gx + dx} y="28" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.85" />
            </g>
          )),
        )}
        {/* cardholder + expiry */}
        <text x="6" y="34.2" fontSize="2.4" letterSpacing="0.35" fill="#ffffff" opacity="0.85">
          ABDULLAH SAEED
        </text>
        <text x="40" y="31.6" fontSize="1.5" letterSpacing="0.3" fill="#ffffff" opacity="0.5">
          VALID THRU
        </text>
        <text x="40" y="34.2" fontSize="2.4" letterSpacing="0.4" fill="#ffffff" opacity="0.85">
          09/29
        </text>
      </g>

      {/* crisp lit rim where face folds into thickness */}
      <path d="M14 44 L42 58 Q46 60.5 50 58 L98 34" stroke="#e6f0ff" strokeOpacity="0.85" strokeWidth="0.8" fill="none" />

      <Spark x={10} y={10} s={0.75} opacity={0.55} />
      <Spark x={108} y={52} s={0.5} opacity={0.4} />
      <circle cx="100" cy="12" r="1" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}

/* ───── 5 · barcode scanner mid-scan, laser on the label ───── */

export function BarcodeIllus() {
  return (
    <svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bc-beam" x1="72" y1="27" x2="30" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff5d7a" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#f43f5e" stopOpacity="0.18" />
          <stop offset="1" stopColor="#f43f5e" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="bc-metalTop" x1="68" y1="10" x2="98" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6b7d96" />
          <stop offset="1" stopColor="#495a72" />
        </linearGradient>
        <linearGradient id="bc-metalFront" x1="87" y1="14" x2="87" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d4d66" />
          <stop offset="1" stopColor="#2c3a51" />
        </linearGradient>
        <linearGradient id="bc-label" x1="6" y1="30" x2="60" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef4fc" />
        </linearGradient>
        <filter id="bc-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="bc-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* label shadow */}
      <ellipse cx="34" cy="58" rx="27" ry="5" fill="#1e3a8a" opacity="0.13" filter="url(#bc-soft)" />
      <ellipse cx="34" cy="57" rx="19" ry="3.2" fill="#0f2a6e" opacity="0.18" filter="url(#bc-soft1)" />

      {/* barcode label lying flat — thumbnail, bars, digits */}
      <g transform="matrix(1 -0.5 1 0.5 6 46)">
        <rect width="34" height="20" rx="2" fill="url(#bc-label)" stroke="#dbe5f4" strokeWidth="0.6" />
        <line x1="1.2" y1="0.7" x2="32.8" y2="0.7" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="0.6" />
        <rect x="3" y="3.5" width="6.5" height="6" rx="0.9" fill="#4F7EF7" />
        <rect x="3" y="3.5" width="6.5" height="2" rx="0.9" fill="#8ab5fc" />
        <circle cx="6.25" cy="7.3" r="0.9" fill="#ffffff" opacity="0.6" />
        <rect x="3" y="11" width="6.5" height="1.2" rx="0.6" fill="#c3d0e4" />
        <rect x="3" y="13.2" width="4.5" height="1.2" rx="0.6" fill="#d6e0ee" />
        <rect x="11.5" y="3.5" width="1.3" height="9.5" fill="#1e293b" />
        <rect x="13.8" y="3.5" width="2.2" height="9.5" fill="#1e293b" />
        <rect x="17" y="3.5" width="1.3" height="9.5" fill="#1e293b" />
        <rect x="19.3" y="3.5" width="1.3" height="9.5" fill="#1e293b" />
        <rect x="21.6" y="3.5" width="2.2" height="9.5" fill="#1e293b" />
        <rect x="24.8" y="3.5" width="1.3" height="9.5" fill="#1e293b" />
        <rect x="27.1" y="3.5" width="2.2" height="9.5" fill="#1e293b" />
        <rect x="30.3" y="3.5" width="1.3" height="9.5" fill="#1e293b" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={12 + i * 2.3} y="15" width="1.4" height="1.4" rx="0.3" fill="#64748b" opacity="0.8" />
        ))}
      </g>

      {/* red spill where the laser rakes the paper */}
      <line x1="20" y1="49" x2="46" y2="36" stroke="#f43f5e" strokeWidth="7" strokeOpacity="0.1" filter="url(#bc-soft)" />

      {/* laser fan — broad wash + hot inner cone + emitter flash */}
      <polygon points="68,25 76,29 47,35.5 19,49.5" fill="url(#bc-beam)" />
      <polygon points="70,26 74.5,28.2 46,36 32,42.5" fill="#ff8fa3" opacity="0.22" />
      <circle cx="72.5" cy="27.5" r="3" fill="#ff8fa3" opacity="0.5" filter="url(#bc-soft1)" />
      <circle cx="72.5" cy="27.5" r="1.1" fill="#ffe4ea" opacity="0.95" />

      {/* scan line kissing the bars */}
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#fb7185" strokeWidth="4.5" strokeOpacity="0.35" filter="url(#bc-soft)" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#f43f5e" strokeWidth="2.6" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#ffd7dd" strokeWidth="1" strokeOpacity="0.95" strokeLinecap="round" />
      <circle cx="27.5" cy="45.4" r="0.8" fill="#ffffff" opacity="0.9" />
      <circle cx="37.5" cy="40.4" r="0.6" fill="#ffd7dd" opacity="0.85" />

      {/* scanner — rubber grip with ribs, brushed-metal head */}
      <polygon points="80,21 86,24 86,38 80,35" fill="#334155" />
      <polygon points="86,24 92,21 92,35 86,38" fill="#1e293b" />
      <line x1="80.4" y1="27.5" x2="85.6" y2="30.1" stroke="#24334c" strokeWidth="1.4" />
      <line x1="80.4" y1="30.7" x2="85.6" y2="33.3" stroke="#24334c" strokeWidth="1.4" />
      <line x1="80.4" y1="33.9" x2="85.6" y2="36.5" stroke="#24334c" strokeWidth="1.4" />
      <line x1="86.4" y1="29.9" x2="91.6" y2="27.3" stroke="#0f1a2c" strokeWidth="1.4" />
      <line x1="86.4" y1="33.1" x2="91.6" y2="30.5" stroke="#0f1a2c" strokeWidth="1.4" />
      <polygon points="80,35 86,38 86,39.4 80,36.4" fill="#0f172a" />
      <polygon points="86,38 92,35 92,36.4 86,39.4" fill="#0b1220" />
      {/* trigger nub */}
      <polygon points="77.2,29.8 80,28.4 80,31.8 77.2,33.2" fill="#101b30" />
      <line x1="77.5" y1="30" x2="80" y2="28.7" stroke="#64748b" strokeOpacity="0.5" strokeWidth="0.5" />
      {/* head slab aimed down the iso axis */}
      <polygon points="68,21 90,10 98,14 76,25" fill="url(#bc-metalTop)" />
      <polygon points="76,25 98,14 98,22 76,33" fill="url(#bc-metalFront)" />
      <polygon points="68,21 76,25 76,33 68,29" fill="#1e293b" />
      <polyline points="68,21 90,10 98,14" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.8" strokeLinejoin="round" fill="none" />
      <line x1="76" y1="25" x2="98" y2="14" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.6" />
      {/* emitter window + inner glow */}
      <polygon points="69.5,23.5 74.5,26 74.5,30 69.5,27.5" fill="#0b1220" />
      <line x1="70.2" y1="24.6" x2="71.4" y2="28.6" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="0.8" />
      <line x1="69.8" y1="25.8" x2="74.2" y2="28" stroke="#f43f5e" strokeWidth="3" strokeOpacity="0.4" filter="url(#bc-soft1)" />
      <line x1="69.8" y1="25.8" x2="74.2" y2="28" stroke="#f43f5e" strokeWidth="1.4" strokeOpacity="0.95" />
      {/* status LED with bloom */}
      <circle cx="91" cy="12.5" r="3.4" fill="#4ade80" opacity="0.25" filter="url(#bc-soft1)" />
      <circle cx="91" cy="12.5" r="2.6" fill="#4ade80" opacity="0.3" />
      <circle cx="91" cy="12.5" r="1.3" fill="#4ade80" />

      <Spark x={88} y={48} s={0.6} opacity={0.45} />
      <circle cx="12" cy="20" r="0.9" fill="#4F7EF7" opacity="0.35" />
    </svg>
  )
}

/* ───── 6 · shopping bag — crinkled tissue, rope handles, brand mark ───── */

export function ShoppingBagIllus() {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-left" x1="30" y1="38" x2="30" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#689af9" />
          <stop offset="0.55" stopColor="#4f7df2" />
          <stop offset="1" stopColor="#3f66e2" />
        </linearGradient>
        <linearGradient id="bg-right" x1="60" y1="38" x2="60" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4472ec" />
          <stop offset="0.55" stopColor="#3a5fd8" />
          <stop offset="1" stopColor="#2c4cb8" />
        </linearGradient>
        <linearGradient id="bg-gold" x1="33" y1="7" x2="33" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <pattern id="bg-clothL" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(58)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" strokeWidth="0.8" />
        </pattern>
        <pattern id="bg-clothR" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#0b1c44" strokeWidth="0.8" />
        </pattern>
        <filter id="bg-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="bg-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="45" cy="95" rx="31" ry="5" fill="#1e3a8a" opacity="0.13" filter="url(#bg-soft)" />
      <ellipse cx="45" cy="94" rx="22" ry="3.4" fill="#0f2a6e" opacity="0.2" filter="url(#bg-soft1)" />

      {/* far handle — twisted rope: dark core + light windings */}
      <path d="M31 34 C33 17 57 16 59 32" stroke="#24479f" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M31 34 C33 17 57 16 59 32" stroke="#3f68cf" strokeWidth="2.9" strokeDasharray="2.8 2.6" fill="none" />

      {/* open top: interior, reflected light, lip occlusion */}
      <polygon points="14,38 45,22.5 76,38 45,53.5" fill="#14285f" />
      <polygon points="20,36.5 45,24.5 70,36.5 45,48.5" fill="#27469e" opacity="0.55" />
      <polygon points="14,38 45,53.5 76,38 45,50.6" fill="#060f2b" opacity="0.5" />

      {/* a gold-boxed product leaning out of the bag */}
      <g transform="rotate(-12 33 24)">
        <rect x="29.5" y="7.5" width="8" height="19" rx="1.2" fill="url(#bg-gold)" />
        <rect x="29.5" y="7.5" width="8" height="2.2" rx="1.1" fill="#fde68a" />
        <rect x="36" y="9" width="1.5" height="17" rx="0.75" fill="#b45309" opacity="0.5" />
        <rect x="29.5" y="13" width="8" height="3.4" fill="#ffffff" opacity="0.85" />
        <circle cx="33.5" cy="14.7" r="0.9" fill="#4F7EF7" />
      </g>
      <ellipse cx="33.5" cy="27" rx="5.5" ry="1.8" fill="#0e2050" opacity="0.45" filter="url(#bg-soft1)" />

      {/* crinkled tissue paper — low, calm mounds so the mouth stays readable */}
      <path
        d="M28 36 Q30 30.5 32.5 33.5 Q35 29 38 32.5 Q41 28.5 44 32 Q47 28.5 50 32.5 Q53 29.5 55.5 33.5 Q57.5 31 59 36 Q45 42.5 28 36 Z"
        fill="#d3ddec"
      />
      <path
        d="M33 38 Q35.5 33 38 35.5 Q41 31.5 44 34.5 Q47 32 50 35 Q53 32.5 55.5 36 Q57 34 58.5 38 Q46 44 33 38 Z"
        fill="#f6f9fe"
      />
      <path d="M44 34.5 Q44.5 38 44.4 41" stroke="#c3d2e6" strokeWidth="0.7" strokeOpacity="0.8" fill="none" />

      {/* bag body — gradient faces, cloth weave, soft creases */}
      <polygon points="14,38 45,53.5 45,93.5 14,78" fill="url(#bg-left)" />
      <polygon points="45,53.5 76,38 76,78 45,93.5" fill="url(#bg-right)" />
      <polygon points="14,38 45,53.5 45,93.5 14,78" fill="url(#bg-clothL)" opacity="0.05" />
      <polygon points="45,53.5 76,38 76,78 45,93.5" fill="url(#bg-clothR)" opacity="0.07" />
      <path d="M26 44 Q24.5 66 26 87" stroke="#2d55c0" strokeWidth="1.2" strokeOpacity="0.25" fill="none" />
      <path d="M60 44 Q61.5 66 60 87" stroke="#1c3a8f" strokeWidth="1.2" strokeOpacity="0.3" fill="none" />
      {/* base occlusion — the bag settles into its own shadow */}
      <polygon points="14,74 45,89.5 45,93.5 14,78" fill="#16337a" opacity="0.25" />
      <polygon points="45,89.5 76,74 76,78 45,93.5" fill="#102456" opacity="0.3" />
      <polyline points="14,38 45,53.5 76,38" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <line x1="45" y1="53.5" x2="45" y2="93.5" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />

      {/* near handle rope over the front rim + punched grommets */}
      <path d="M32 49 C35 31 55 30 58 48" stroke="#142c66" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <path d="M32 49 C35 31 55 30 58 48" stroke="#3d63c8" strokeWidth="3" strokeDasharray="2.8 2.6" fill="none" />
      <circle cx="32" cy="49.5" r="2.1" fill="#10265c" />
      <circle cx="32" cy="49.5" r="0.95" fill="#060f2b" />
      <path d="M30.5 48.6 a2.1 2.1 0 0 1 2.2 -1.1" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" fill="none" />
      <circle cx="58" cy="48.5" r="2.1" fill="#10265c" />
      <circle cx="58" cy="48.5" r="0.95" fill="#060f2b" />
      <path d="M56.5 47.6 a2.1 2.1 0 0 1 2.2 -1.1" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" fill="none" />

      {/* brand mark printed on the lit face — soft emboss */}
      <g transform="translate(14 38) skewY(26.565)">
        <circle cx="13" cy="13.4" r="3.4" stroke="#0e2050" strokeOpacity="0.3" strokeWidth="1.8" fill="none" />
        <rect x="18" y="9.9" width="2.6" height="7.4" rx="1.3" fill="#0e2050" opacity="0.3" />
        <circle cx="13" cy="13" r="3.4" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.8" fill="none" />
        <rect x="18" y="9.5" width="2.6" height="7.4" rx="1.3" fill="#ffffff" opacity="0.6" />
        <text x="15.5" y="28.35" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.5" fill="#0e2050" opacity="0.3">
          flowin
        </text>
        <text x="15.5" y="28" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.5" fill="#ffffff" opacity="0.92">
          flowin
        </text>
      </g>

      <Spark x={10} y={18} s={0.65} opacity={0.5} />
      <Spark x={81} y={58} s={0.5} opacity={0.4} />
    </svg>
  )
}

/* ───── 7 · coin stack — gold warmth against the blues, top coin afloat ───── */

export function CoinStackIllus() {
  return (
    <svg viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cn-side" x1="16" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a4408" />
          <stop offset="0.22" stopColor="#c9670b" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="0.78" stopColor="#b45309" />
          <stop offset="1" stopColor="#7c3d06" />
        </linearGradient>
        <linearGradient id="cn-flat" x1="40" y1="39" x2="40" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbd45c" />
          <stop offset="1" stopColor="#edb129" />
        </linearGradient>
        {/* hero top face — highlight parked at 10 o'clock */}
        <radialGradient id="cn-top" cx="0.32" cy="0.26" r="0.9">
          <stop offset="0" stopColor="#fff3c8" />
          <stop offset="0.45" stopColor="#fbd45c" />
          <stop offset="0.8" stopColor="#f0ac1c" />
          <stop offset="1" stopColor="#d9910e" />
        </radialGradient>
        <filter id="cn-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="cn-soft2" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="cn-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>

      {/* contact shadow + a longer smear thrown down the iso axis */}
      <ellipse cx="40" cy="81" rx="28" ry="6" fill="#1e3a8a" opacity="0.18" filter="url(#cn-soft)" />
      <g transform="translate(52 83) rotate(26.565)">
        <ellipse rx="24" ry="4.6" fill="#1e3a8a" opacity="0.12" filter="url(#cn-soft)" />
      </g>

      {/* stacked coins, slight jitter so the pile feels hand-placed */}
      <path d="M16 67 L16 74 A24 12 0 0 0 64 74 L64 67 A24 12 0 0 1 16 67 Z" fill="url(#cn-side)" />
      <CoinKnurl cx={40} cy={67} h={7} />
      <path d="M16 74 A24 12 0 0 0 64 74" stroke="#6b3405" strokeOpacity="0.55" strokeWidth="0.75" fill="none" />
      <ellipse cx="40" cy="67" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="40" cy="67" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />

      <path d="M18 59 L18 66 A24 12 0 0 0 66 66 L66 59 A24 12 0 0 1 18 59 Z" fill="url(#cn-side)" />
      <CoinKnurl cx={42} cy={59} h={7} />
      <path d="M18 66 A24 12 0 0 0 66 66" stroke="#6b3405" strokeOpacity="0.55" strokeWidth="0.75" fill="none" />
      <ellipse cx="42" cy="59" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="42" cy="59" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />

      <path d="M15 51 L15 58 A24 12 0 0 0 63 58 L63 51 A24 12 0 0 1 15 51 Z" fill="url(#cn-side)" />
      <CoinKnurl cx={39} cy={51} h={7} />
      <path d="M15 58 A24 12 0 0 0 63 58" stroke="#6b3405" strokeOpacity="0.55" strokeWidth="0.75" fill="none" />
      <ellipse cx="39" cy="51" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="39" cy="51" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />
      <ellipse cx="39" cy="51" rx="17.5" ry="8.75" stroke="#d99a10" strokeWidth="0.9" strokeOpacity="0.6" fill="none" />
      <path d="M15.4 48.9 A24 12 0 0 1 28 40.2" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round" fill="none" />

      {/* hovering top coin + the shadow it throws on the pile */}
      <ellipse cx="39" cy="51" rx="15" ry="6" fill="#92400e" opacity="0.32" filter="url(#cn-soft2)" />
      <ellipse cx="39" cy="51" rx="9" ry="3.6" fill="#7c3d06" opacity="0.3" filter="url(#cn-soft1)" />
      <path d="M16 29 L16 36 A24 12 0 0 0 64 36 L64 29 A24 12 0 0 1 16 29 Z" fill="url(#cn-side)" />
      <CoinKnurl cx={40} cy={29} h={7} />
      {/* bounce light kisses the floating coin's lower rim */}
      <path d="M20 40.5 A24 12 0 0 0 60 40.5" stroke="#ffd76a" strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
      <ellipse cx="40" cy="29" rx="24" ry="12" fill="url(#cn-top)" />
      <CoinSerration cx={40} cy={29} />
      <ellipse cx="40" cy="29" rx="17.5" ry="8.75" stroke="#d99a10" strokeWidth="1.1" strokeOpacity="0.8" fill="none" />
      {/* soft specular at 10 o'clock */}
      <g transform="rotate(-20 32.5 24.5)">
        <ellipse cx="32.5" cy="24.5" rx="5.5" ry="2.2" fill="#ffffff" opacity="0.4" filter="url(#cn-soft1)" />
      </g>
      {/* flowin mark — raised emboss: shadow, highlight, face */}
      <g transform="translate(40.4 29.6) scale(1 0.5)">
        <circle cx="-6" cy="0" r="6.5" stroke="#8a4a08" strokeWidth="3" strokeOpacity="0.35" fill="none" />
        <rect x="4.5" y="-9" width="5" height="18" rx="2.5" fill="#8a4a08" opacity="0.35" />
      </g>
      <g transform="translate(39.6 28.5) scale(1 0.5)">
        <circle cx="-6" cy="0" r="6.5" stroke="#ffe9a3" strokeWidth="3" strokeOpacity="0.5" fill="none" />
        <rect x="4.5" y="-9" width="5" height="18" rx="2.5" fill="#ffe9a3" opacity="0.5" />
      </g>
      <g transform="translate(40 29) scale(1 0.5)">
        <circle cx="-6" cy="0" r="6.5" stroke="#c47f08" strokeWidth="3" fill="none" />
        <rect x="4.5" y="-9" width="5" height="18" rx="2.5" fill="#c47f08" />
      </g>
      <path d="M16.4 26.9 A24 12 0 0 1 31.8 17.7" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" fill="none" />

      <Spark x={12} y={12} s={0.8} fill="#fbbf24" opacity={0.9} />
      <Spark x={67} y={38} s={0.55} fill="#f59e0b" opacity={0.6} />
      <circle cx="60" cy="14" r="1" fill="#fde68a" opacity="0.7" />
    </svg>
  )
}

/* ───── 8 · product box — packing tape, shipping label, crushed corner ───── */

export function ProductBoxIllus() {
  return (
    <svg viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bx-top" x1="30" y1="19" x2="60" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eaf3ff" />
          <stop offset="0.6" stopColor="#d6e7fd" />
          <stop offset="1" stopColor="#c3d9fa" />
        </linearGradient>
        <linearGradient id="bx-left" x1="30" y1="34" x2="30" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6dabfc" />
          <stop offset="1" stopColor="#4a86f0" />
        </linearGradient>
        <linearGradient id="bx-right" x1="60" y1="34" x2="60" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3f7ef4" />
          <stop offset="1" stopColor="#2b5ecf" />
        </linearGradient>
        <linearGradient id="bx-tape" x1="27" y1="27" x2="63" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fbff" />
          <stop offset="1" stopColor="#dce9fc" />
        </linearGradient>
        <filter id="bx-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="bx-soft1" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        {/* layer-1 depth of field */}
        <filter id="bx-dof" x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix type="saturate" values="0.9" />
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
      </defs>

      <g filter="url(#bx-dof)">
        {/* ground shadow */}
        <ellipse cx="45" cy="85" rx="29" ry="5" fill="#1e3a8a" opacity="0.13" filter="url(#bx-soft)" />
        <ellipse cx="45" cy="84" rx="21" ry="3.4" fill="#0f2a6e" opacity="0.2" filter="url(#bx-soft1)" />

        {/* box faces */}
        <polygon points="15,34 45,49 45,83 15,68" fill="url(#bx-left)" />
        <polygon points="45,49 75,34 75,68 45,83" fill="url(#bx-right)" />
        <polygon points="15,34 45,19 75,34 45,49" fill="url(#bx-top)" />

        {/* corrugated cardboard ribs, following each face's iso slope */}
        <g transform="translate(15 34) skewY(26.565)">
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="0" y1={6 + i * 4.2} x2="30" y2={6 + i * 4.2} stroke="#1e3f9e" strokeOpacity="0.05" strokeWidth="0.7" />
          ))}
        </g>
        <g transform="translate(45 49) skewY(-26.565)">
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="0" y1={6 + i * 4.2} x2="30" y2={6 + i * 4.2} stroke="#0d2a6e" strokeOpacity="0.07" strokeWidth="0.7" />
          ))}
        </g>

        {/* base occlusion on both flanks */}
        <polygon points="15,63.5 45,78.5 45,83 15,68" fill="#1c3f9e" opacity="0.16" />
        <polygon points="45,78.5 75,63.5 75,68 45,83" fill="#132f78" opacity="0.2" />

        {/* flap seam + half-flap shading + top sheen */}
        <polygon points="30,26.5 45,19 75,34 60,41.5" fill="#1e3f9e" opacity="0.05" />
        <line x1="30" y1="26.5" x2="60" y2="41.5" stroke="#7ea0d4" strokeOpacity="0.7" strokeWidth="0.9" />
        <line x1="30" y1="25.9" x2="60" y2="40.9" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.5" />
        <polygon points="26,29 36,24 56,34 46,39" fill="#ffffff" opacity="0.09" />

        {/* flowin watermark printed on the shaded flank */}
        <g transform="translate(45 49) skewY(-26.565)">
          <circle cx="12" cy="15" r="5" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.2" fill="none" />
          <rect x="19.5" y="9.5" width="3.4" height="11" rx="1.7" fill="#ffffff" opacity="0.35" />
        </g>

        {/* frosted packing tape along the seam, folding down the flank */}
        <polygon points="27.1,27.9 32.9,25.1 62.9,40.1 57.1,42.9" fill="url(#bx-tape)" opacity="0.88" />
        <polygon points="57.1,42.9 62.9,40.1 62.9,49.8 57.1,52.6" fill="#cfe0f8" opacity="0.85" />
        <line x1="57.1" y1="52.6" x2="62.9" y2="49.8" stroke="#a8c2ea" strokeOpacity="0.7" strokeWidth="0.6" />
        <line x1="29.2" y1="27.2" x2="60.2" y2="42.2" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.7" />
        <line x1="27.1" y1="27.9" x2="57.1" y2="42.9" stroke="#a8c2ea" strokeOpacity="0.5" strokeWidth="0.4" />
        <line x1="32.9" y1="25.1" x2="62.9" y2="40.1" stroke="#a8c2ea" strokeOpacity="0.5" strokeWidth="0.4" />

        {/* edge highlights */}
        <polyline points="15,34 45,19 75,34" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" strokeLinejoin="round" fill="none" />
        <polyline points="15,34 45,49 75,34" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
        <line x1="45" y1="49" x2="45" y2="83" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />

        {/* shipping label on the lit face — logo, address, barcode, QR */}
        <g transform="translate(15 34) skewY(26.565)">
          <rect x="6.1" y="8.2" width="20" height="15" rx="1.2" fill="#1c3f9e" opacity="0.18" />
          <rect x="5.5" y="7.5" width="20" height="15" rx="1.2" fill="#f8fafc" />
          <circle cx="8.8" cy="10.6" r="1.7" stroke="#4F7EF7" strokeWidth="1.1" fill="none" />
          <rect x="11.2" y="9.4" width="1.4" height="3.4" rx="0.7" fill="#4F7EF7" />
          <rect x="8" y="14" width="14" height="1.4" rx="0.7" fill="#c3d0e4" />
          <rect x="8" y="16.4" width="10" height="1.4" rx="0.7" fill="#c3d0e4" />
          <rect x="8" y="18.8" width="0.7" height="2.6" fill="#334155" />
          <rect x="9.5" y="18.8" width="1.1" height="2.6" fill="#334155" />
          <rect x="11.2" y="18.8" width="0.7" height="2.6" fill="#334155" />
          <rect x="12.6" y="18.8" width="1.1" height="2.6" fill="#334155" />
          <rect x="14.3" y="18.8" width="0.7" height="2.6" fill="#334155" />
          <rect x="15.7" y="18.8" width="0.7" height="2.6" fill="#334155" />
          <rect x="17.1" y="18.8" width="1.1" height="2.6" fill="#334155" />
          <rect x="20.5" y="17.6" width="4.2" height="4.2" rx="0.6" fill="#4F7EF7" />
          <rect x="21.3" y="18.4" width="1" height="1" fill="#ffffff" opacity="0.85" />
          <rect x="23" y="18.4" width="1" height="1" fill="#ffffff" opacity="0.85" />
          <rect x="21.3" y="20.1" width="1" height="1" fill="#ffffff" opacity="0.85" />
          {/* gold fragile sticker */}
          <rect x="20.8" y="3.6" width="5.4" height="2.6" rx="0.7" fill="#f59e0b" opacity="0.92" />
          <rect x="21.6" y="4.4" width="3.8" height="1" rx="0.5" fill="#ffffff" opacity="0.65" />
        </g>

        {/* crushed corner — one honest imperfection */}
        <polygon points="75,61.8 75,68 69.6,65.2" fill="#2a58c6" />
        <line x1="75" y1="61.8" x2="69.6" y2="65.2" stroke="#1c3f9e" strokeOpacity="0.7" strokeWidth="0.7" />
        <line x1="69.6" y1="65.2" x2="75" y2="68" stroke="#86adf7" strokeOpacity="0.5" strokeWidth="0.6" />

        <Spark x={81} y={17} s={0.6} opacity={0.55} />
        <circle cx="10" cy="24" r="0.9" fill="#4F7EF7" opacity="0.35" />
      </g>
    </svg>
  )
}
