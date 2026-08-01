/* 3D isometric POS illustrations — login backdrop.
   Palette: top #dbeafe/#eff6ff · lit #60a5fa/#93c5fd · shade #3b82f6/#1d4ed8
   Hardware: #475569/#334155/#1e293b · accent #4F7EF7 · gold #f59e0b · laser #f43f5e
   One feGaussianBlur per component (ground shadow only) — kept intentionally light. */

function Spark({ x, y, s = 1, fill = '#4F7EF7', opacity = 0.6 }: {
  x: number; y: number; s?: number; fill?: string; opacity?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <path d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8 Z" fill={fill} />
      <path d="M0 -3.4 C.45 -.9 .9 -.45 3.4 0 C.9 .45 .45 .9 0 3.4 C-.45 .9 -.9 .45 -3.4 0 C-.9 -.45 -.45 -.9 0 -3.4 Z" fill="#fff" opacity="0.85" />
    </g>
  )
}

/* ── 1 · POS terminal on a counter ── */
export function PosTerminalIllus() {
  return (
    <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pt-desk" x1="40" y1="70" x2="170" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f2f7ff" /><stop offset="1" stopColor="#c6dbfa" />
        </linearGradient>
        <linearGradient id="pt-deskL" x1="70" y1="106" x2="70" y2="172" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6faefb" /><stop offset="1" stopColor="#4c8df2" />
        </linearGradient>
        <linearGradient id="pt-deskR" x1="160" y1="117" x2="160" y2="172" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d7cf0" /><stop offset="1" stopColor="#2d5ecf" />
        </linearGradient>
        <linearGradient id="pt-body" x1="80" y1="82" x2="120" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#55647d" /><stop offset="1" stopColor="#3c4a62" />
        </linearGradient>
        <linearGradient id="pt-slabtop" x1="68" y1="24" x2="126" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5d6d87" /><stop offset="1" stopColor="#414f66" />
        </linearGradient>
        <linearGradient id="pt-paper" x1="97" y1="15" x2="97" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eee9da" />
        </linearGradient>
        <linearGradient id="pt-metal" x1="138" y1="98" x2="162" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#94a8c2" /><stop offset="0.5" stopColor="#67799a" /><stop offset="1" stopColor="#556685" />
        </linearGradient>
        <filter id="pt-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="110" cy="164" rx="80" ry="7" fill="#1e3a8a" opacity="0.15" filter="url(#pt-blur)" />

      {/* counter */}
      <polygon points="18,106 120,157 120,170 18,119" fill="url(#pt-deskL)" />
      <polygon points="120,157 200,117 200,130 120,170" fill="url(#pt-deskR)" />
      <polygon points="18,106 98,66 200,117 120,157" fill="url(#pt-desk)" />
      <polyline points="18,106 98,66 200,117" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" fill="none" />
      <polyline points="18,106 120,157 200,117" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.4" fill="none" />

      {/* contact shadow */}
      <ellipse cx="99" cy="110" rx="38" ry="10" fill="#0a1e46" opacity="0.22" filter="url(#pt-blur)" />

      {/* terminal base */}
      <polygon points="66,96 104,115 104,122 66,103" fill="#334155" />
      <polygon points="104,115 134,100 134,107 104,122" fill="#1e293b" />
      <polygon points="66,96 96,81 134,100 104,115" fill="url(#pt-body)" />
      <polyline points="66,96 96,81 134,100" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.8" fill="none" />

      {/* neck */}
      <polygon points="94,94 110,86 110,74 94,82" fill="#334155" />

      {/* display slab */}
      <polygon points="74,97 74,53 68,50 68,94" fill="#0f172a" />
      <polygon points="74,53 126,27 120,24 68,50" fill="url(#pt-slabtop)" />
      <polyline points="68,50 120,24" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />

      {/* receipt slot + paper */}
      <polygon points="84,46 112,32 109,30.5 81,44.5" fill="#020617" />
      <polygon points="88,42 106,33 106,15 88,24" fill="url(#pt-paper)" />
      <path d="M88 24 Q95 20.2 100 17.6 Q103.5 15.8 106 15.6 L106 18.8 Q102.5 18.6 98.2 20.9 Q93 23.7 88 26.8 Z" fill="#d7e2f2" />
      <line x1="88" y1="24" x2="106" y2="15" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.7" />
      <g transform="translate(88 42) skewY(-26.565)">
        <line x1="3" y1="-14" x2="15" y2="-14" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-10" x2="12" y2="-10" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-6" x2="14" y2="-6" stroke="#4F7EF7" strokeOpacity="0.6" strokeWidth="1.4" />
      </g>

      {/* screen */}
      <polygon points="74,97 126,71 126,27 74,53" fill="#1e293b" />
      <line x1="74" y1="97" x2="126" y2="71" stroke="#4F7EF7" strokeOpacity="0.2" strokeWidth="1" />
      <g transform="translate(74 97) skewY(-26.565)">
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="#0b1526" />
        <ellipse cx="26" cy="-26" rx="14" ry="5" fill="#4F7EF7" opacity="0.25" />
        <polygon points="13,-39 21,-39 9,-13 1,-13" fill="#fff" opacity="0.05" />
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="none" stroke="#4F7EF7" strokeOpacity="0.35" strokeWidth="0.8" />
        <circle cx="8.6" cy="-36.4" r="0.9" fill="#62E6C7" />
        <text x="26" y="-31.5" textAnchor="middle" fontSize="4.6" fill="#7c8db1">الإجمالي</text>
        <text x="26" y="-21.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#b6ccff">SAR ٤٥٠</text>
        {([[-4,-10],[7,-10],[18,-10],[29,-10],[-4,-5.5],[7,-5.5],[18,-5.5]] as [number,number][]).map(([kx,ky]) => (
          <rect key={`${kx}${ky}`} x={kx+9} y={ky} width="8" height="3" rx="1" fill="#31405a" />
        ))}
        <rect x="38" y="-5.5" width="8" height="3" rx="1" fill="#4F7EF7" />
      </g>

      {/* card reader */}
      <ellipse cx="150" cy="118.5" rx="14" ry="4" fill="#0a1e46" opacity="0.2" />
      <polygon points="138,104 150,110 150,120 138,114" fill="#475569" />
      <polygon points="150,110 162,104 162,114 150,120" fill="#334155" />
      <polygon points="138,104 150,98 162,104 150,110" fill="url(#pt-metal)" />
      <polyline points="138,104 150,98 162,104" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" fill="none" />
      <polygon points="143,103 153,98 153,88 143,93" fill="#60a5fa" />
      <line x1="143" y1="90.5" x2="153" y2="85.5" stroke="#dbeafe" strokeWidth="1.4" strokeOpacity="0.9" />

      {/* stylus */}
      <line x1="147" y1="128.5" x2="165" y2="137.5" stroke="#1f2c40" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="148" y1="128.2" x2="164" y2="136.2" stroke="#8ea2bd" strokeOpacity="0.7" strokeWidth="0.7" strokeLinecap="round" />
      <polygon points="164.8,136.1 168.4,139.2 165,138.9" fill="#9fb0c8" />

      <Spark x={52} y={34} s={0.85} opacity={0.6} />
      <circle cx="36" cy="58" r="1" fill="#4F7EF7" opacity="0.3" />
    </svg>
  )
}

/* ── 2 · cashier character ── */
export function CashierIllus() {
  return (
    <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ch-face" cx="0.44" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#ffe4c6" /><stop offset="0.55" stopColor="#fbcf9f" /><stop offset="1" stopColor="#edb07c" />
        </radialGradient>
        <radialGradient id="ch-hand" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffd3a9" /><stop offset="1" stopColor="#f0ad7d" />
        </radialGradient>
        <linearGradient id="ch-hair" x1="80" y1="24" x2="80" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e4061" /><stop offset="1" stopColor="#1c2942" />
        </linearGradient>
        <linearGradient id="ch-shirt" x1="58" y1="72" x2="102" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6493fb" /><stop offset="0.55" stopColor="#476fee" /><stop offset="1" stopColor="#3a5fd8" />
        </linearGradient>
        <linearGradient id="ch-counter" x1="40" y1="108" x2="120" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0f6ff" /><stop offset="1" stopColor="#c7ddfb" />
        </linearGradient>
        <linearGradient id="ch-counterL" x1="45" y1="138" x2="45" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6aa9fb" /><stop offset="1" stopColor="#4a85ef" />
        </linearGradient>
        <linearGradient id="ch-counterR" x1="115" y1="138" x2="115" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3f7bf1" /><stop offset="1" stopColor="#2c5ccf" />
        </linearGradient>
        <filter id="ch-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <ellipse cx="80" cy="190" rx="58" ry="6" fill="#1e3a8a" opacity="0.14" filter="url(#ch-blur)" />

      {/* resting arm */}
      <path d="M60 88 Q46 98 49 112" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="49.5" cy="113" r="5.2" fill="url(#ch-hand)" />

      {/* neck */}
      <rect x="74.5" y="61" width="11" height="12" rx="3.5" fill="#efae7d" />
      <ellipse cx="80" cy="69.4" rx="5.6" ry="1.9" fill="#c47b4e" opacity="0.5" />

      {/* torso */}
      <rect x="53" y="70" width="54" height="56" rx="17" fill="url(#ch-shirt)" />
      <path d="M104.5 84 Q107.5 100 102.5 118" stroke="#2b4fc0" strokeWidth="4.5" strokeOpacity="0.2" strokeLinecap="round" fill="none" />
      <path d="M56.5 84 Q54 100 58 116" stroke="#8fb0ff" strokeWidth="4" strokeOpacity="0.2" strokeLinecap="round" fill="none" />
      <path d="M63 95 Q68 100 66.5 112" stroke="#2c53c9" strokeWidth="1.8" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      <path d="M71 71 L80 82 L89 71 Z" fill="#dbeafe" opacity="0.95" />
      <rect x="87" y="88" width="11" height="7" rx="2" fill="#eff6ff" />
      <rect x="89" y="90.3" width="7" height="1.6" rx="0.8" fill="#4F7EF7" opacity="0.8" />

      {/* head */}
      <circle cx="57" cy="48" r="4" fill="#f3b482" />
      <circle cx="103" cy="48" r="4" fill="#f3b482" />
      <rect x="58" y="26" width="44" height="42" rx="15" fill="url(#ch-face)" />
      <ellipse cx="80" cy="63.8" rx="15" ry="3.5" fill="#e09a66" opacity="0.2" />
      {/* hair */}
      <path d="M58 42 L58 37 Q58 24 74 24 L86 24 Q102 24 102 37 L102 42 Q94 36.5 80 36.5 Q66 36.5 58 42 Z" fill="url(#ch-hair)" />
      <path d="M63.5 28.2 Q69 24.9 78 24.8 Q85 24.8 89.5 26.4 Q81 26.4 73.5 27.5 Q67 28.6 63.5 28.2 Z" fill="#5a76a8" opacity="0.6" />
      {/* brows */}
      <path d="M67.5 43.5 Q71 41.8 74.5 43.3" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M85.5 43.3 Q89 41.8 92.5 43.5" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <circle cx="71" cy="49" r="3" fill="#6b4423" />
      <circle cx="89" cy="49" r="3" fill="#6b4423" />
      <circle cx="71" cy="49" r="1.5" fill="#141c30" />
      <circle cx="89" cy="49" r="1.5" fill="#141c30" />
      <circle cx="70" cy="47.9" r="0.95" fill="#fff" opacity="0.95" />
      <circle cx="88" cy="47.9" r="0.95" fill="#fff" opacity="0.95" />
      {/* nose + smile */}
      <path d="M79.6 50.5 Q81.4 53.2 79.8 54.8" stroke="#e2a678" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="65.5" cy="55" r="2.8" fill="#fb923c" opacity="0.28" />
      <circle cx="94.5" cy="55" r="2.8" fill="#fb923c" opacity="0.28" />
      <path d="M74 57 Q80 62.5 86 57" stroke="#24334a" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* counter */}
      <polygon points="10,138 80,173 80,195 10,160" fill="url(#ch-counterL)" />
      <polygon points="80,173 150,138 150,160 80,195" fill="url(#ch-counterR)" />
      <polygon points="10,138 80,103 150,138 80,173" fill="url(#ch-counter)" />
      <polyline points="10,138 80,103 150,138" stroke="#fff" strokeOpacity="0.3" strokeWidth="1" fill="none" />
      <polyline points="10,138 80,173 150,138" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" fill="none" />

      {/* far-hand fingers */}
      <g transform="rotate(-18 49.5 114)">
        <rect x="45.8" y="112.5" width="1.9" height="4.6" rx="0.95" fill="#f7bb90" />
        <rect x="48.4" y="113.1" width="1.9" height="4.9" rx="0.95" fill="#f7bb90" />
        <rect x="51" y="112.7" width="1.9" height="4.4" rx="0.95" fill="#f7bb90" />
      </g>

      {/* mini register */}
      <polygon points="104,130 118,137 118,146 104,139" fill="#334155" />
      <polygon points="118,137 132,130 132,139 118,146" fill="#1e293b" />
      <polygon points="104,130 118,123 132,130 118,137" fill="#475569" />
      <polyline points="104,130 118,123 132,130" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.7" fill="none" />
      <g transform="translate(104 130) skewY(26.565)">
        {([2.5,6.5,10.5] as number[]).map(x => <rect key={x} x={x} y="2.8" width="3" height="1.7" rx="0.5" fill="#1e2b40" />)}
        {([2.5,6.5] as number[]).map(x => <rect key={x} x={x} y="5.4" width="3" height="1.7" rx="0.5" fill="#1e2b40" />)}
        <rect x="10.5" y="5.4" width="3" height="1.7" rx="0.5" fill="#4F7EF7" />
      </g>

      {/* active arm */}
      <path d="M98 84 Q114 94 119 124" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="119.5" cy="126" r="5.4" fill="url(#ch-hand)" />
      <g transform="rotate(24 119.5 126)">
        <rect x="116.6" y="129.2" width="2" height="4.8" rx="1" fill="#f7bb90" />
        <rect x="119.1" y="129.6" width="2" height="5" rx="1" fill="#f7bb90" />
        <rect x="121.6" y="129.2" width="2" height="4.6" rx="1" fill="#f7bb90" />
      </g>

      <Spark x={16} y={58} s={0.55} opacity={0.42} />
      <Spark x={146} y={72} s={0.5} opacity={0.32} />
    </svg>
  )
}

/* ── 3 · receipt ── */
export function ReceiptIllus() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rc-paper" x1="24" y1="16" x2="66" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e9f0fb" />
        </linearGradient>
        <linearGradient id="rc-curlin" x1="22" y1="0" x2="22" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a9bad3" /><stop offset="1" stopColor="#dde6f3" />
        </linearGradient>
        <linearGradient id="rc-curlout" x1="30" y1="0" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fbff" /><stop offset="1" stopColor="#d9e4f4" />
        </linearGradient>
        <filter id="rc-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* drop shadow */}
      <path d="M24.5 22.5 Q42.5 14.5 62.5 16.5 L68.5 100.5 L62 107 L55.5 102.8 L49 108.5 L42.5 104.2 L36 110 L29.5 105.5 Z"
        fill="#1e3a8a" opacity="0.09" filter="url(#rc-blur)" />

      {/* paper strip */}
      <path d="M22 19 Q40 11 60 13 L66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102 Z" fill="url(#rc-paper)" />
      <path d="M22 19 Q40 11 60 13 L22 19" stroke="#b9c7db" strokeWidth="0.6" fill="none" opacity="0.4" />
      <path d="M66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102" stroke="#b9c7db" strokeWidth="0.8" strokeOpacity="0.6" fill="none" />

      {/* curl */}
      <g transform="translate(22 19) scale(0.82) translate(-22 -19)">
        <path d="M22 19 Q12.5 12.5 14 5 Q15.5 -1.8 24.5 -0.8 Q31.5 0 30.8 6.2 Q30.2 11 26 16.6 Q24 18.2 22 19 Z" fill="url(#rc-curlin)" />
        <path d="M24.5 -0.8 Q31.5 0 30.8 6.2 Q30.2 11 26 16.6 Q28.6 10.4 28.3 5.4 Q28 0.9 22.8 0.3 Q23.6 -0.5 24.5 -0.8 Z" fill="url(#rc-curlout)" />
        <path d="M15.6 7.6 Q15.2 1.8 21.5 0.2" stroke="#fff" strokeWidth="1" strokeOpacity="0.7" strokeLinecap="round" fill="none" />
      </g>

      {/* printed content */}
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
        {([0,3,6.5,10,13,16.5,20,24] as number[]).map((x,i) => (
          <rect key={i} x={26+x} y="84" width={i%2===0?1.6:2.6} height="12" fill="#334155" />
        ))}
      </g>

      <Spark x={14} y={48} s={0.6} opacity={0.5} />
    </svg>
  )
}

/* ── 4 · credit card ── */
export function CreditCardIllus() {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cc-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cb0fd" /><stop offset="0.5" stopColor="#4b86f4" /><stop offset="1" stopColor="#2a60dd" />
        </linearGradient>
        <linearGradient id="cc-edge" x1="56" y1="34" x2="56" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c58c8" /><stop offset="1" stopColor="#14297a" />
        </linearGradient>
        <linearGradient id="cc-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" /><stop offset="0.55" stopColor="#f5b93a" /><stop offset="1" stopColor="#e08c07" />
        </linearGradient>
        <linearGradient id="cc-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9ad5" /><stop offset="0.33" stopColor="#ffd36e" /><stop offset="0.63" stopColor="#86f7c5" /><stop offset="1" stopColor="#6ea8ff" />
        </linearGradient>
        <filter id="cc-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id="cc-clip"><rect width="56" height="36" rx="5" /></clipPath>
      </defs>

      <ellipse cx="58" cy="70" rx="40" ry="5" fill="#1e3a8a" opacity="0.14" filter="url(#cc-blur)" />

      {/* card edge */}
      <path d="M14 44 L42 58 Q46 60.5 50 58 L98 34 L98 39.5 L50 63.5 Q46 66 42 63.5 L14 49.5 Z" fill="url(#cc-edge)" />

      {/* card face */}
      <g transform="matrix(1 -0.5 1 0.5 10 42)">
        <rect width="56" height="36" rx="5" fill="url(#cc-face)" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.6" />
        <g clipPath="url(#cc-clip)">
          <circle cx="55" cy="32" r="16" stroke="#fff" strokeOpacity="0.06" strokeWidth="6" fill="none" />
          <circle cx="2" cy="3" r="11" stroke="#fff" strokeOpacity="0.05" strokeWidth="5" fill="none" />
          <rect width="56" height="36" rx="5" fill="#fff" opacity="0.04" />
          <path d="M34 0 L44 0 L28 36 L18 36 Z" fill="#fff" opacity="0.07" />
        </g>
        <path d="M5 0.4 L51 0.4" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round" />
        {/* chip */}
        <rect x="6" y="7" width="9" height="7" rx="1.5" fill="url(#cc-chip)" />
        <rect x="6" y="7" width="9" height="7" rx="1.5" stroke="#92610a" strokeOpacity="0.5" strokeWidth="0.4" fill="none" />
        <path d="M6 10.5 h9 M10.5 7 v7" stroke="#b45309" strokeWidth="0.5" opacity="0.6" />
        {/* contactless */}
        <path d="M22 8.5 a3.8 3.8 0 0 1 0 7.6" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" fill="none" />
        <path d="M24.3 10.4 a1.9 1.9 0 0 1 0 3.8" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" fill="none" />
        {/* holographic patch */}
        <rect x="45" y="4.5" width="8.5" height="7" rx="1.2" fill="url(#cc-rainbow)" opacity="0.9" />
        <ellipse cx="47.7" cy="6.5" rx="1.4" ry="0.9" fill="#fff" opacity="0.7" />
        <text x="21" y="25" textAnchor="middle" fontSize="6.5" fontWeight="800" letterSpacing="1.1" fill="#fff" opacity="0.95">FLOWIN</text>
        {/* digit blocks */}
        {([6,17.5,29,40.5] as number[]).map(gx => ([0,2.7,5.4,8.1] as number[]).map(dx => (
          <rect key={`${gx}-${dx}`} x={gx+dx} y="28" width="2" height="2" rx="0.5" fill="#fff" opacity="0.8" />
        )))}
        <text x="6" y="34.2" fontSize="2.4" letterSpacing="0.35" fill="#fff" opacity="0.8">ABDULLAH SAEED</text>
        <text x="40" y="34.2" fontSize="2.4" letterSpacing="0.4" fill="#fff" opacity="0.8">09/29</text>
      </g>

      <path d="M14 44 L42 58 Q46 60.5 50 58 L98 34" stroke="#e6f0ff" strokeOpacity="0.8" strokeWidth="0.8" fill="none" />
      <Spark x={10} y={10} s={0.75} opacity={0.55} />
      <Spark x={108} y={52} s={0.5} opacity={0.4} />
    </svg>
  )
}

/* ── 5 · barcode scanner ── */
export function BarcodeIllus() {
  return (
    <svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bc-beam" x1="72" y1="27" x2="30" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff5d7a" stopOpacity="0.5" /><stop offset="1" stopColor="#f43f5e" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="bc-metalTop" x1="68" y1="10" x2="98" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6b7d96" /><stop offset="1" stopColor="#495a72" />
        </linearGradient>
        <linearGradient id="bc-metalFront" x1="87" y1="14" x2="87" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d4d66" /><stop offset="1" stopColor="#2c3a51" />
        </linearGradient>
        <linearGradient id="bc-label" x1="6" y1="30" x2="60" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef4fc" />
        </linearGradient>
        <filter id="bc-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <ellipse cx="34" cy="58" rx="26" ry="4.5" fill="#1e3a8a" opacity="0.14" filter="url(#bc-blur)" />

      {/* barcode label */}
      <g transform="matrix(1 -0.5 1 0.5 6 46)">
        <rect width="34" height="20" rx="2" fill="url(#bc-label)" stroke="#dbe5f4" strokeWidth="0.6" />
        <rect x="3" y="3.5" width="6.5" height="6" rx="0.9" fill="#4F7EF7" />
        <rect x="3" y="11" width="6.5" height="1.2" rx="0.6" fill="#c3d0e4" />
        <rect x="3" y="13.2" width="4.5" height="1.2" rx="0.6" fill="#d6e0ee" />
        {([0,2.3,5.5,7.8,10,12.3,14.6,17] as number[]).map((x,i) => (
          <rect key={i} x={11.5+x} y="3.5" width={i%3===1?2.2:1.3} height="9.5" fill="#1e293b" />
        ))}
      </g>

      {/* laser */}
      <polygon points="68,25 76,29 47,35.5 19,49.5" fill="url(#bc-beam)" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#f43f5e" strokeWidth="2.6" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#ffd7dd" strokeWidth="0.9" strokeOpacity="0.9" strokeLinecap="round" />
      <circle cx="72.5" cy="27.5" r="1.1" fill="#ffe4ea" opacity="0.95" />

      {/* scanner body */}
      <polygon points="80,21 86,24 86,38 80,35" fill="#334155" />
      <polygon points="86,24 92,21 92,35 86,38" fill="#1e293b" />
      <line x1="80.4" y1="27.5" x2="85.6" y2="30.1" stroke="#24334c" strokeWidth="1.4" />
      <line x1="80.4" y1="30.7" x2="85.6" y2="33.3" stroke="#24334c" strokeWidth="1.4" />
      <polygon points="77.2,29.8 80,28.4 80,31.8 77.2,33.2" fill="#101b30" />
      <polygon points="68,21 90,10 98,14 76,25" fill="url(#bc-metalTop)" />
      <polygon points="76,25 98,14 98,22 76,33" fill="url(#bc-metalFront)" />
      <polygon points="68,21 76,25 76,33 68,29" fill="#1e293b" />
      <polyline points="68,21 90,10 98,14" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />
      {/* emitter */}
      <polygon points="69.5,23.5 74.5,26 74.5,30 69.5,27.5" fill="#0b1220" />
      <line x1="69.8" y1="25.8" x2="74.2" y2="28" stroke="#f43f5e" strokeWidth="1.4" strokeOpacity="0.9" />
      <circle cx="91" cy="12.5" r="1.3" fill="#4ade80" />

      <Spark x={88} y={48} s={0.6} opacity={0.45} />
    </svg>
  )
}

/* ── 6 · shopping bag ── */
export function ShoppingBagIllus() {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-left" x1="30" y1="38" x2="30" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#689af9" /><stop offset="1" stopColor="#3f66e2" />
        </linearGradient>
        <linearGradient id="bg-right" x1="60" y1="38" x2="60" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4472ec" /><stop offset="1" stopColor="#2c4cb8" />
        </linearGradient>
        <linearGradient id="bg-gold" x1="33" y1="7" x2="33" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fcd34d" /><stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <filter id="bg-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <ellipse cx="45" cy="95" rx="30" ry="4.5" fill="#1e3a8a" opacity="0.14" filter="url(#bg-blur)" />

      {/* far handle */}
      <path d="M31 34 C33 17 57 16 59 32" stroke="#24479f" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M31 34 C33 17 57 16 59 32" stroke="#3f68cf" strokeWidth="2.8" strokeDasharray="2.8 2.6" fill="none" />

      {/* interior */}
      <polygon points="14,38 45,22.5 76,38 45,53.5" fill="#14285f" />
      <polygon points="20,36.5 45,24.5 70,36.5 45,48.5" fill="#27469e" opacity="0.5" />

      {/* product leaning out */}
      <g transform="rotate(-12 33 24)">
        <rect x="29.5" y="7.5" width="8" height="19" rx="1.2" fill="url(#bg-gold)" />
        <rect x="29.5" y="7.5" width="8" height="2.2" rx="1.1" fill="#fde68a" />
        <rect x="29.5" y="13" width="8" height="3.4" fill="#fff" opacity="0.8" />
        <circle cx="33.5" cy="14.7" r="0.9" fill="#4F7EF7" />
      </g>

      {/* tissue */}
      <path d="M28 36 Q30 30.5 32.5 33.5 Q35 29 38 32.5 Q41 28.5 44 32 Q47 28.5 50 32.5 Q53 29.5 55.5 33.5 Q57.5 31 59 36 Q45 42.5 28 36 Z" fill="#d3ddec" />
      <path d="M33 38 Q35.5 33 38 35.5 Q41 31.5 44 34.5 Q47 32 50 35 Q53 32.5 55.5 36 Q57 34 58.5 38 Q46 44 33 38 Z" fill="#f6f9fe" />

      {/* bag body */}
      <polygon points="14,38 45,53.5 45,93.5 14,78" fill="url(#bg-left)" />
      <polygon points="45,53.5 76,38 76,78 45,93.5" fill="url(#bg-right)" />
      <path d="M26 44 Q24.5 66 26 87" stroke="#2d55c0" strokeWidth="1.2" strokeOpacity="0.22" fill="none" />
      <path d="M60 44 Q61.5 66 60 87" stroke="#1c3a8f" strokeWidth="1.2" strokeOpacity="0.25" fill="none" />
      <polygon points="14,74 45,89.5 45,93.5 14,78" fill="#16337a" opacity="0.22" />
      <polygon points="45,89.5 76,74 76,78 45,93.5" fill="#102456" opacity="0.26" />
      <polyline points="14,38 45,53.5 76,38" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />

      {/* near handle + grommets */}
      <path d="M32 49 C35 31 55 30 58 48" stroke="#142c66" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <path d="M32 49 C35 31 55 30 58 48" stroke="#3d63c8" strokeWidth="3" strokeDasharray="2.8 2.6" fill="none" />
      <circle cx="32" cy="49.5" r="2.1" fill="#10265c" />
      <circle cx="32" cy="49.5" r="0.95" fill="#060f2b" />
      <circle cx="58" cy="48.5" r="2.1" fill="#10265c" />
      <circle cx="58" cy="48.5" r="0.95" fill="#060f2b" />

      {/* brand mark */}
      <g transform="translate(14 38) skewY(26.565)">
        <circle cx="13" cy="13" r="3.4" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" fill="none" />
        <rect x="18" y="9.5" width="2.6" height="7.4" rx="1.3" fill="#fff" opacity="0.55" />
        <text x="15.5" y="28" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.5" fill="#fff" opacity="0.85">flowin</text>
      </g>

      <Spark x={10} y={18} s={0.65} opacity={0.5} />
    </svg>
  )
}

/* ── 7 · coin stack ── */
export function CoinStackIllus() {
  return (
    <svg viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cn-side" x1="16" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a4408" /><stop offset="0.22" stopColor="#c9670b" /><stop offset="0.5" stopColor="#fbbf24" /><stop offset="0.78" stopColor="#b45309" /><stop offset="1" stopColor="#7c3d06" />
        </linearGradient>
        <linearGradient id="cn-flat" x1="40" y1="39" x2="40" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbd45c" /><stop offset="1" stopColor="#edb129" />
        </linearGradient>
        <radialGradient id="cn-top" cx="0.32" cy="0.26" r="0.9">
          <stop offset="0" stopColor="#fff3c8" /><stop offset="0.45" stopColor="#fbd45c" /><stop offset="1" stopColor="#d9910e" />
        </radialGradient>
        <filter id="cn-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <ellipse cx="40" cy="81" rx="28" ry="6" fill="#1e3a8a" opacity="0.17" filter="url(#cn-blur)" />

      {/* coin 1 (bottom) */}
      <path d="M16 67 L16 74 A24 12 0 0 0 64 74 L64 67 A24 12 0 0 1 16 67 Z" fill="url(#cn-side)" />
      <path d="M16 74 A24 12 0 0 0 64 74" stroke="#6b3405" strokeOpacity="0.5" strokeWidth="0.75" fill="none" />
      <ellipse cx="40" cy="67" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="40" cy="67" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.4" strokeWidth="0.7" fill="none" />

      {/* coin 2 */}
      <path d="M18 59 L18 66 A24 12 0 0 0 66 66 L66 59 A24 12 0 0 1 18 59 Z" fill="url(#cn-side)" />
      <path d="M18 66 A24 12 0 0 0 66 66" stroke="#6b3405" strokeOpacity="0.5" strokeWidth="0.75" fill="none" />
      <ellipse cx="42" cy="59" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="42" cy="59" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.4" strokeWidth="0.7" fill="none" />

      {/* coin 3 */}
      <path d="M15 51 L15 58 A24 12 0 0 0 63 58 L63 51 A24 12 0 0 1 15 51 Z" fill="url(#cn-side)" />
      <path d="M15 58 A24 12 0 0 0 63 58" stroke="#6b3405" strokeOpacity="0.5" strokeWidth="0.75" fill="none" />
      <ellipse cx="39" cy="51" rx="24" ry="12" fill="url(#cn-flat)" />
      <ellipse cx="39" cy="51" rx="17.5" ry="8.75" stroke="#d99a10" strokeWidth="0.8" strokeOpacity="0.5" fill="none" />
      <path d="M15.4 48.9 A24 12 0 0 1 28 40.2" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" fill="none" />

      {/* floating top coin */}
      <ellipse cx="39" cy="49" rx="14" ry="5.5" fill="#92400e" opacity="0.25" filter="url(#cn-blur)" />
      <path d="M16 29 L16 36 A24 12 0 0 0 64 36 L64 29 A24 12 0 0 1 16 29 Z" fill="url(#cn-side)" />
      <path d="M20 40.5 A24 12 0 0 0 60 40.5" stroke="#ffd76a" strokeOpacity="0.4" strokeWidth="0.8" fill="none" />
      <ellipse cx="40" cy="29" rx="24" ry="12" fill="url(#cn-top)" />
      <ellipse cx="40" cy="29" rx="17.5" ry="8.75" stroke="#d99a10" strokeWidth="1" strokeOpacity="0.7" fill="none" />
      {/* specular */}
      <g transform="rotate(-20 32.5 24.5)">
        <ellipse cx="32.5" cy="24.5" rx="5.5" ry="2.2" fill="#fff" opacity="0.35" />
      </g>
      {/* flowin mark */}
      <g transform="translate(40 29) scale(1 0.5)">
        <circle cx="-6" cy="0" r="6.5" stroke="#c47f08" strokeWidth="3" fill="none" />
        <rect x="4.5" y="-9" width="5" height="18" rx="2.5" fill="#c47f08" />
      </g>
      <path d="M16.4 26.9 A24 12 0 0 1 31.8 17.7" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" fill="none" />

      <Spark x={12} y={12} s={0.8} fill="#fbbf24" opacity={0.9} />
      <Spark x={67} y={38} s={0.55} fill="#f59e0b" opacity={0.6} />
    </svg>
  )
}

/* ── 8 · product box ── */
export function ProductBoxIllus() {
  return (
    <svg viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bx-top" x1="30" y1="19" x2="60" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eaf3ff" /><stop offset="1" stopColor="#c3d9fa" />
        </linearGradient>
        <linearGradient id="bx-left" x1="30" y1="34" x2="30" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6dabfc" /><stop offset="1" stopColor="#4a86f0" />
        </linearGradient>
        <linearGradient id="bx-right" x1="60" y1="34" x2="60" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3f7ef4" /><stop offset="1" stopColor="#2b5ecf" />
        </linearGradient>
        <linearGradient id="bx-tape" x1="27" y1="27" x2="63" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fbff" /><stop offset="1" stopColor="#dce9fc" />
        </linearGradient>
        <filter id="bx-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <ellipse cx="45" cy="85" rx="28" ry="4.5" fill="#1e3a8a" opacity="0.14" filter="url(#bx-blur)" />

      {/* box faces */}
      <polygon points="15,34 45,49 45,83 15,68" fill="url(#bx-left)" />
      <polygon points="45,49 75,34 75,68 45,83" fill="url(#bx-right)" />
      <polygon points="15,34 45,19 75,34 45,49" fill="url(#bx-top)" />

      {/* base occlusion */}
      <polygon points="15,63.5 45,78.5 45,83 15,68" fill="#1c3f9e" opacity="0.14" />
      <polygon points="45,78.5 75,63.5 75,68 45,83" fill="#132f78" opacity="0.17" />

      {/* flap seam */}
      <polygon points="30,26.5 45,19 75,34 60,41.5" fill="#1e3f9e" opacity="0.05" />
      <line x1="30" y1="26.5" x2="60" y2="41.5" stroke="#7ea0d4" strokeOpacity="0.65" strokeWidth="0.9" />
      <polygon points="26,29 36,24 56,34 46,39" fill="#fff" opacity="0.08" />

      {/* watermark on shaded face */}
      <g transform="translate(45 49) skewY(-26.565)">
        <circle cx="12" cy="15" r="5" stroke="#fff" strokeOpacity="0.3" strokeWidth="2.2" fill="none" />
        <rect x="19.5" y="9.5" width="3.4" height="11" rx="1.7" fill="#fff" opacity="0.3" />
      </g>

      {/* tape */}
      <polygon points="27.1,27.9 32.9,25.1 62.9,40.1 57.1,42.9" fill="url(#bx-tape)" opacity="0.88" />
      <polygon points="57.1,42.9 62.9,40.1 62.9,49.8 57.1,52.6" fill="#cfe0f8" opacity="0.85" />
      <line x1="29.2" y1="27.2" x2="60.2" y2="42.2" stroke="#fff" strokeOpacity="0.38" strokeWidth="0.7" />

      {/* edges */}
      <polyline points="15,34 45,19 75,34" stroke="#fff" strokeOpacity="0.38" strokeWidth="1" fill="none" />
      <polyline points="15,34 45,49 75,34" stroke="#fff" strokeOpacity="0.62" strokeWidth="1.2" fill="none" />
      <line x1="45" y1="49" x2="45" y2="83" stroke="#fff" strokeOpacity="0.2" strokeWidth="1" />

      {/* shipping label */}
      <g transform="translate(15 34) skewY(26.565)">
        <rect x="5.5" y="7.5" width="20" height="15" rx="1.2" fill="#f8fafc" />
        <circle cx="8.8" cy="10.6" r="1.7" stroke="#4F7EF7" strokeWidth="1.1" fill="none" />
        <rect x="11.2" y="9.4" width="1.4" height="3.4" rx="0.7" fill="#4F7EF7" />
        <rect x="8" y="14" width="14" height="1.4" rx="0.7" fill="#c3d0e4" />
        <rect x="8" y="16.4" width="10" height="1.4" rx="0.7" fill="#c3d0e4" />
        {([0,1.5,3,4.5,6,7.5,9] as number[]).map((x,i) => (
          <rect key={i} x={8+x} y="18.8" width={i%2===0?0.7:1.1} height="2.6" fill="#334155" />
        ))}
        <rect x="20.5" y="17.6" width="4.2" height="4.2" rx="0.6" fill="#4F7EF7" />
        <rect x="21.3" y="18.4" width="1" height="1" fill="#fff" opacity="0.8" />
        <rect x="23" y="18.4" width="1" height="1" fill="#fff" opacity="0.8" />
        <rect x="21.3" y="20.1" width="1" height="1" fill="#fff" opacity="0.8" />
      </g>

      {/* crushed corner */}
      <polygon points="75,61.8 75,68 69.6,65.2" fill="#2a58c6" />
      <line x1="75" y1="61.8" x2="69.6" y2="65.2" stroke="#1c3f9e" strokeOpacity="0.65" strokeWidth="0.7" />

      <Spark x={81} y={17} s={0.6} opacity={0.55} />
    </svg>
  )
}
