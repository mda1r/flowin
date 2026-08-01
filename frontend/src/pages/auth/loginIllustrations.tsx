/* ────────────────────────────────────────────────────────────────
   3D isometric POS illustrations — the login backdrop cast.
   Pure inline SVG, 2:1 isometric projection (every slanted edge
   moves 2px horizontally per 1px vertically), one shared palette:

     top faces     #dbeafe → #eff6ff   (light catches the top)
     lit sides     #60a5fa / #93c5fd   (front-left, toward light)
     shaded sides  #3b82f6 → #1d4ed8   (front-right, away)
     dark hardware #475569 / #334155 / #1e293b / #0f172a
     accent        #4F7EF7  ·  gold #f59e0b  ·  laser #f43f5e

   Iso text/labels sit on faces via skewY(±26.565°) — atan(1/2) —
   so type lies flat on the projected plane instead of floating.
   Gradient/filter ids are prefixed per component (pt-, ch-, …)
   because all eight render into the same document.
   ──────────────────────────────────────────────────────────────── */

/* ───── 1 · POS terminal on a counter — the hero piece ───── */

export function PosTerminalIllus() {
  return (
    <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pt-desk" x1="40" y1="70" x2="170" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef4fe" />
          <stop offset="1" stopColor="#cddffb" />
        </linearGradient>
        <linearGradient id="pt-card" x1="143" y1="88" x2="153" y2="103" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8ab5fc" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <filter id="pt-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="pt-soft2" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="110" cy="164" rx="84" ry="8" fill="#1e3a8a" opacity="0.16" filter="url(#pt-soft)" />

      {/* counter — light top, lit left flank, shaded right flank */}
      <polygon points="18,106 120,157 120,170 18,119" fill="#60a5fa" />
      <polygon points="120,157 200,117 200,130 120,170" fill="#3b82f6" />
      <polygon points="18,106 98,66 200,117 120,157" fill="url(#pt-desk)" />
      <polyline points="18,106 98,66 200,117" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <polyline points="18,106 120,157 200,117" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.5" strokeLinejoin="round" fill="none" />

      {/* screen light pooling on the counter */}
      <ellipse cx="124" cy="116" rx="36" ry="13" fill="#4F7EF7" opacity="0.22" filter="url(#pt-soft)" />

      {/* terminal base */}
      <polygon points="66,96 104,115 104,122 66,103" fill="#334155" />
      <polygon points="104,115 134,100 134,107 104,122" fill="#1e293b" />
      <polygon points="66,96 96,81 134,100 104,115" fill="#475569" />

      {/* neck joining base to display */}
      <polygon points="94,94 110,86 110,74 94,82" fill="#334155" />

      {/* display slab — dark side, lit top edge */}
      <polygon points="74,97 74,53 68,50 68,94" fill="#0f172a" />
      <polygon points="74,53 126,27 120,24 68,50" fill="#475569" />

      {/* receipt printer slot + paper curling out */}
      <polygon points="84,46 112,32 109,30.5 81,44.5" fill="#020617" />
      <polygon points="88,42 106,33 106,15 88,24" fill="#f8fafc" />
      <g transform="translate(88 42) skewY(-26.565)">
        <line x1="3" y1="-14" x2="15" y2="-14" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-10" x2="12" y2="-10" stroke="#cbd5e1" strokeWidth="1.4" />
        <line x1="3" y1="-6" x2="14" y2="-6" stroke="#4F7EF7" strokeOpacity="0.6" strokeWidth="1.4" />
      </g>

      {/* screen face: glowing total + keypad row */}
      <polygon points="74,97 126,71 126,27 74,53" fill="#1e293b" />
      <g transform="translate(74 97) skewY(-26.565)">
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="#0f172a" />
        <ellipse cx="26" cy="-26" rx="16" ry="6" fill="#4F7EF7" opacity="0.3" filter="url(#pt-soft2)" />
        <rect x="5" y="-39" width="42" height="26" rx="2.5" fill="none" stroke="#4F7EF7" strokeOpacity="0.4" strokeWidth="0.8" />
        <text x="26" y="-31.5" textAnchor="middle" fontSize="4.6" fill="#7c8db1">
          الإجمالي
        </text>
        <text x="26" y="-21.5" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.3" fill="#9db9ff">
          SAR ٤٥٠
        </text>
        <rect x="6" y="-10" width="8" height="3" rx="1" fill="#334155" />
        <rect x="17" y="-10" width="8" height="3" rx="1" fill="#334155" />
        <rect x="28" y="-10" width="8" height="3" rx="1" fill="#334155" />
        <rect x="39" y="-10" width="8" height="3" rx="1" fill="#334155" />
        <rect x="6" y="-5.5" width="8" height="3" rx="1" fill="#334155" />
        <rect x="17" y="-5.5" width="8" height="3" rx="1" fill="#334155" />
        <rect x="28" y="-5.5" width="8" height="3" rx="1" fill="#334155" />
        <rect x="39" y="-5.5" width="8" height="3" rx="1" fill="#4F7EF7" />
      </g>

      {/* card reader beside the terminal, card mid-swipe */}
      <polygon points="138,104 150,110 150,120 138,114" fill="#475569" />
      <polygon points="150,110 162,104 162,114 150,120" fill="#334155" />
      <polygon points="138,104 150,98 162,104 150,110" fill="#64748b" />
      <polygon points="143,103 153,98 153,88 143,93" fill="url(#pt-card)" />
      <line x1="143" y1="90.5" x2="153" y2="85.5" stroke="#dbeafe" strokeWidth="1.5" strokeOpacity="0.9" />
      <polygon points="142,104.5 152,99.5 154.4,100.7 144.4,105.7" fill="#0f172a" />

      {/* ambient sparkles */}
      <path d="M52 36 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" fill="#4F7EF7" opacity="0.55" />
      <path d="M182 82 l1.1 2.7 2.7 1.1 -2.7 1.1 -1.1 2.7 -1.1 -2.7 -2.7 -1.1 2.7 -1.1 Z" fill="#4F7EF7" opacity="0.4" />
    </svg>
  )
}

/* ───── 2 · the cashier — friendly geometric character at the till ───── */

export function CashierIllus() {
  return (
    <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ch-skin" x1="80" y1="26" x2="80" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd9b4" />
          <stop offset="1" stopColor="#f5bd8e" />
        </linearGradient>
        <linearGradient id="ch-shirt" x1="58" y1="72" x2="102" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f8ffa" />
          <stop offset="1" stopColor="#3e6ceb" />
        </linearGradient>
        <linearGradient id="ch-counter" x1="40" y1="108" x2="120" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ecf3fe" />
          <stop offset="1" stopColor="#cbdffc" />
        </linearGradient>
        <filter id="ch-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="80" cy="190" rx="62" ry="6.5" fill="#1e3a8a" opacity="0.15" filter="url(#ch-soft)" />

      {/* resting arm (behind torso), hand settling on the counter edge */}
      <path d="M60 88 Q46 98 49 112" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="49.5" cy="113" r="5.2" fill="#fbc59b" />

      {/* torso — blue uniform, white collar, name badge */}
      <rect x="53" y="70" width="54" height="56" rx="17" fill="url(#ch-shirt)" />
      <path d="M71 71 L80 82 L89 71 Z" fill="#dbeafe" opacity="0.95" />
      <rect x="87" y="88" width="11" height="7" rx="2" fill="#eff6ff" />
      <rect x="89" y="90.5" width="7" height="1.6" rx="0.8" fill="#4F7EF7" opacity="0.8" />

      {/* head — ears, face, hair */}
      <circle cx="57" cy="48" r="4" fill="#f3b482" />
      <circle cx="103" cy="48" r="4" fill="#f3b482" />
      <rect x="58" y="26" width="44" height="42" rx="15" fill="url(#ch-skin)" />
      <path d="M58 42 L58 37 Q58 24 74 24 L86 24 Q102 24 102 37 L102 42 Q94 36.5 80 36.5 Q66 36.5 58 42 Z" fill="#24334a" />
      <path d="M67.5 43.5 Q71 41.8 74.5 43.3" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M85.5 43.3 Q89 41.8 92.5 43.5" stroke="#24334a" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="71" cy="49" r="2.7" fill="#24334a" />
      <circle cx="89" cy="49" r="2.7" fill="#24334a" />
      <circle cx="71.9" cy="48.2" r="0.9" fill="#ffffff" opacity="0.9" />
      <circle cx="89.9" cy="48.2" r="0.9" fill="#ffffff" opacity="0.9" />
      <circle cx="65.5" cy="55" r="2.8" fill="#fb923c" opacity="0.3" />
      <circle cx="94.5" cy="55" r="2.8" fill="#fb923c" opacity="0.3" />
      <path d="M74 57 Q80 62.5 86 57" stroke="#24334a" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* checkout counter */}
      <polygon points="10,138 80,173 80,195 10,160" fill="#60a5fa" />
      <polygon points="80,173 150,138 150,160 80,195" fill="#3b82f6" />
      <polygon points="10,138 80,103 150,138 80,173" fill="url(#ch-counter)" />
      <polyline points="10,138 80,173 150,138" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      {/* panel detailing on the lit flank */}
      <g transform="translate(10 138) skewY(26.565)">
        <rect x="7" y="6" width="26" height="12" rx="2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
        <rect x="37" y="6" width="26" height="12" rx="2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
      </g>

      {/* mini register on the counter */}
      <polygon points="106,127 120,120 120,111 106,118" fill="#0f172a" />
      <line x1="109" y1="121.5" x2="117" y2="117.5" stroke="#62E6C7" strokeWidth="1.6" strokeOpacity="0.95" />
      <polygon points="104,130 118,137 118,146 104,139" fill="#334155" />
      <polygon points="118,137 132,130 132,139 118,146" fill="#1e293b" />
      <polygon points="104,130 118,123 132,130 118,137" fill="#475569" />

      {/* extended arm reaching over to ring up the sale */}
      <path d="M98 84 Q114 94 119 124" stroke="#3a67ea" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="119.5" cy="126" r="5.4" fill="#fbc59b" />
    </svg>
  )
}

/* ───── 3 · drifting receipt — curled top, zig-zag tear ───── */

export function ReceiptIllus() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rc-paper" x1="24" y1="16" x2="66" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9f0fb" />
        </linearGradient>
      </defs>

      {/* rolled-over curl at the top */}
      <path d="M22 19 Q17 7 30 6.5 Q25 10 26.5 17 Z" fill="#d7e2f2" />

      {/* paper strip with torn bottom edge */}
      <path
        d="M22 19 Q40 11 60 13 L66 97 L59.5 103.5 L53 99.3 L46.5 105 L40 100.7 L33.5 106.5 L27 102 Z"
        fill="url(#rc-paper)"
      />

      {/* printed content, tilted with the strip */}
      <g transform="rotate(-7 44 55)">
        <circle cx="33" cy="30" r="4.5" stroke="#4F7EF7" strokeWidth="2.2" fill="none" />
        <rect x="40.5" y="24.5" width="3.6" height="11" rx="1.8" fill="#4F7EF7" />
        <rect x="26" y="44" width="28" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="55" y="44" width="6" height="3" rx="1.5" fill="#a8b8cf" />
        <rect x="26" y="51" width="20" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="55" y="51" width="6" height="3" rx="1.5" fill="#a8b8cf" />
        <rect x="26" y="58" width="24" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="55" y="58" width="6" height="3" rx="1.5" fill="#a8b8cf" />
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

      <path d="M14 48 l1 2.8 2.8 1 -2.8 1 -1 2.8 -1 -2.8 -2.8 -1 2.8 -1 Z" fill="#4F7EF7" opacity="0.5" />
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
          <stop offset="0" stopColor="#6ea8fc" />
          <stop offset="1" stopColor="#2f6ae8" />
        </linearGradient>
        <linearGradient id="cc-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id="cc-holo">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="cc-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="58" cy="70" rx="42" ry="5.5" fill="#1e3a8a" opacity="0.18" filter="url(#cc-soft)" />

      {/* visible card edge (thickness) */}
      <path d="M14 44 L42 58 Q46 60.5 50 58 L98 34 L98 39 L50 63 Q46 65.5 42 63 L14 49 Z" fill="#1e40af" />

      {/* card face on the iso plane */}
      <g transform="matrix(1 -0.5 1 0.5 10 42)">
        <rect width="56" height="36" rx="5" fill="url(#cc-face)" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.6" />
        <path d="M22 0 h9 l-12 36 h-9 Z" fill="#ffffff" opacity="0.12" />
        <rect x="6" y="7" width="9" height="7" rx="1.5" fill="url(#cc-chip)" />
        <path d="M6 10.5 h9 M10.5 7 v7" stroke="#b45309" strokeWidth="0.5" opacity="0.7" />
        <path d="M22 8.5 a3.8 3.8 0 0 1 0 7.6" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" fill="none" />
        <path d="M24.3 10.4 a1.9 1.9 0 0 1 0 3.8" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" fill="none" />
        <circle cx="49" cy="8.5" r="4.2" fill="url(#cc-holo)" />
        <text x="21" y="25.5" textAnchor="middle" fontSize="6.5" fontWeight="800" letterSpacing="1.1" fill="#ffffff" opacity="0.95">
          FLOWIN
        </text>
        {/* four blocks of four digits */}
        {[6, 17.5, 29, 40.5].map((gx) =>
          [0, 2.7, 5.4, 8.1].map((dx) => (
            <rect key={`${gx}-${dx}`} x={gx + dx} y="30.5" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.8" />
          )),
        )}
      </g>

      <path d="M10 10 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#4F7EF7" opacity="0.5" />
    </svg>
  )
}

/* ───── 5 · barcode scanner mid-scan, laser on the label ───── */

export function BarcodeIllus() {
  return (
    <svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bc-beam" x1="72" y1="27" x2="30" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f43f5e" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f43f5e" stopOpacity="0.04" />
        </linearGradient>
        <filter id="bc-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* label shadow */}
      <ellipse cx="34" cy="58" rx="27" ry="5" fill="#1e3a8a" opacity="0.15" filter="url(#bc-soft)" />

      {/* barcode label lying flat */}
      <g transform="matrix(1 -0.5 1 0.5 6 46)">
        <rect width="34" height="20" rx="2" fill="#fbfdff" stroke="#dbe5f4" strokeWidth="0.6" />
        <rect x="3.5" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="6" y="3.5" width="2.3" height="13" fill="#1e293b" />
        <rect x="9.5" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="12" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="14.5" y="3.5" width="2.3" height="13" fill="#1e293b" />
        <rect x="18" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="20.5" y="3.5" width="2.3" height="13" fill="#1e293b" />
        <rect x="24" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="26.5" y="3.5" width="1.4" height="13" fill="#1e293b" />
        <rect x="29" y="3.5" width="2.3" height="13" fill="#1e293b" />
      </g>

      {/* laser fan + scan line kissing the bars */}
      <polygon points="68,25 76,29 47,35.5 19,49.5" fill="url(#bc-beam)" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#fb7185" strokeWidth="4.5" strokeOpacity="0.35" filter="url(#bc-soft)" />
      <line x1="19" y1="49.5" x2="47" y2="35.5" stroke="#f43f5e" strokeWidth="1.8" strokeOpacity="0.95" strokeLinecap="round" />

      {/* scanner — grip, then head slab aimed down the iso axis */}
      <polygon points="80,21 86,24 86,38 80,35" fill="#334155" />
      <polygon points="86,24 92,21 92,35 86,38" fill="#1e293b" />
      <polygon points="68,21 90,10 98,14 76,25" fill="#475569" />
      <polygon points="76,25 98,14 98,22 76,33" fill="#334155" />
      <polygon points="68,21 76,25 76,33 68,29" fill="#1e293b" />
      <polygon points="69.5,23.5 74.5,26 74.5,30 69.5,27.5" fill="#0b1220" />
      <line x1="69.8" y1="25.8" x2="74.2" y2="28" stroke="#f43f5e" strokeWidth="1.4" strokeOpacity="0.95" />
      <circle cx="91" cy="12.5" r="2.6" fill="#4ade80" opacity="0.3" />
      <circle cx="91" cy="12.5" r="1.3" fill="#4ade80" />

      <path d="M88 46 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z" fill="#4F7EF7" opacity="0.45" />
    </svg>
  )
}

/* ───── 6 · shopping bag — tissue paper, rope handles, brand mark ───── */

export function ShoppingBagIllus() {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-left" x1="30" y1="38" x2="30" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f8ef8" />
          <stop offset="1" stopColor="#4a78f0" />
        </linearGradient>
        <linearGradient id="bg-right" x1="60" y1="38" x2="60" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3e6ce8" />
          <stop offset="1" stopColor="#3157cf" />
        </linearGradient>
        <filter id="bg-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="45" cy="95" rx="31" ry="5" fill="#1e3a8a" opacity="0.16" filter="url(#bg-soft)" />

      {/* far handle, then the open top with tissue */}
      <path d="M31 34 C33 17 57 16 59 32" stroke="#24479f" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <polygon points="14,38 45,22.5 76,38 45,53.5" fill="#182f73" />
      <path d="M27 36 Q33 17 43 29 Q49 18 57 31 L57 38 Q42 44 27 38 Z" fill="#dde6f3" />
      <path d="M33 37 Q41 22 49 32 Q55 25 62 36 L62 42 Q47 47 33 42 Z" fill="#f6f9fe" />

      {/* bag body */}
      <polygon points="14,38 45,53.5 45,93.5 14,78" fill="url(#bg-left)" />
      <polygon points="45,53.5 76,38 76,78 45,93.5" fill="url(#bg-right)" />
      <polyline points="14,38 45,53.5 76,38" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="45" y1="53.5" x2="45" y2="93.5" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />

      {/* near handle over the front rim */}
      <path d="M32 49 C35 31 55 30 58 48" stroke="#16337a" strokeWidth="3.2" strokeLinecap="round" fill="none" />

      {/* brand mark printed on the lit face */}
      <g transform="translate(14 38) skewY(26.565)">
        <circle cx="13" cy="13" r="3.4" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.8" fill="none" />
        <rect x="18" y="9.5" width="2.6" height="7.4" rx="1.3" fill="#ffffff" opacity="0.55" />
        <text x="15.5" y="28" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing="0.5" fill="#ffffff" opacity="0.92">
          flowin
        </text>
      </g>

      <path d="M10 18 l1.1 2.7 2.7 1.1 -2.7 1.1 -1.1 2.7 -1.1 -2.7 -2.7 -1.1 2.7 -1.1 Z" fill="#4F7EF7" opacity="0.5" />
      <path d="M81 56 l0.9 2.3 2.3 0.9 -2.3 0.9 -0.9 2.3 -0.9 -2.3 -2.3 -0.9 2.3 -0.9 Z" fill="#4F7EF7" opacity="0.4" />
    </svg>
  )
}

/* ───── 7 · coin stack — gold warmth against the blues, top coin afloat ───── */

export function CoinStackIllus() {
  return (
    <svg viewBox="0 0 80 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cn-side" x1="16" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id="cn-top" cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#fdeaa8" />
          <stop offset="0.65" stopColor="#f8c944" />
          <stop offset="1" stopColor="#edaa1e" />
        </radialGradient>
        <filter id="cn-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="cn-soft2" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="40" cy="80" rx="27" ry="5.5" fill="#1e3a8a" opacity="0.15" filter="url(#cn-soft)" />

      {/* stacked coins, slight jitter so the pile feels hand-placed */}
      <path d="M16 67 L16 74 A24 12 0 0 0 64 74 L64 67 A24 12 0 0 1 16 67 Z" fill="url(#cn-side)" />
      <ellipse cx="40" cy="67" rx="24" ry="12" fill="#f7c33c" />
      <ellipse cx="40" cy="67" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />
      <path d="M18 59 L18 66 A24 12 0 0 0 66 66 L66 59 A24 12 0 0 1 18 59 Z" fill="url(#cn-side)" />
      <ellipse cx="42" cy="59" rx="24" ry="12" fill="#f7c33c" />
      <ellipse cx="42" cy="59" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />
      <path d="M15 51 L15 58 A24 12 0 0 0 63 58 L63 51 A24 12 0 0 1 15 51 Z" fill="url(#cn-side)" />
      <ellipse cx="39" cy="51" rx="24" ry="12" fill="#f7c33c" />
      <ellipse cx="39" cy="51" rx="24" ry="12" stroke="#b45309" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />

      {/* hovering top coin + the shadow it throws on the pile */}
      <ellipse cx="39" cy="51" rx="14" ry="5.5" fill="#92400e" opacity="0.3" filter="url(#cn-soft2)" />
      <path d="M16 29 L16 36 A24 12 0 0 0 64 36 L64 29 A24 12 0 0 1 16 29 Z" fill="url(#cn-side)" />
      <ellipse cx="40" cy="29" rx="24" ry="12" fill="url(#cn-top)" />
      <ellipse cx="40" cy="29" rx="17.5" ry="8.75" stroke="#d99a10" strokeWidth="1.1" strokeOpacity="0.8" fill="none" />
      {/* flowin mark embossed on the face */}
      <g transform="translate(40 29) scale(1 0.5)">
        <circle cx="-6" cy="0" r="6.5" stroke="#c47f08" strokeWidth="3" fill="none" />
        <rect x="4.5" y="-9" width="5" height="18" rx="2.5" fill="#c47f08" />
      </g>
      <path d="M16.4 26.9 A24 12 0 0 1 31.8 17.7" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" fill="none" />

      <path d="M12 10 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" fill="#fbbf24" opacity="0.9" />
      <path d="M66 36 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z" fill="#f59e0b" opacity="0.6" />
    </svg>
  )
}

/* ───── 8 · product box — packing tape, shipping label, watermark ───── */

export function ProductBoxIllus() {
  return (
    <svg viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bx-top" x1="30" y1="19" x2="60" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e2eefe" />
          <stop offset="1" stopColor="#c8ddfb" />
        </linearGradient>
        <linearGradient id="bx-left" x1="30" y1="34" x2="30" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#63a6fb" />
          <stop offset="1" stopColor="#4e8bf4" />
        </linearGradient>
        <linearGradient id="bx-right" x1="60" y1="34" x2="60" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#2f68d8" />
        </linearGradient>
        <filter id="bx-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="45" cy="85" rx="29" ry="5" fill="#1e3a8a" opacity="0.16" filter="url(#bx-soft)" />

      {/* box faces */}
      <polygon points="15,34 45,49 45,83 15,68" fill="url(#bx-left)" />
      <polygon points="45,49 75,34 75,68 45,83" fill="url(#bx-right)" />
      <polygon points="15,34 45,19 75,34 45,49" fill="url(#bx-top)" />

      {/* packing tape across the lid, folding down the shaded flank */}
      <polygon points="27,28 33,25 63,40 57,43" fill="#f1f6ff" opacity="0.95" />
      <polygon points="57,43 63,40 63,49 57,52" fill="#dbe9ff" opacity="0.9" />

      {/* edge highlights */}
      <polyline points="15,34 45,19 75,34" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" fill="none" />
      <polyline points="15,34 45,49 75,34" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="45" y1="49" x2="45" y2="83" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />

      {/* shipping label on the lit face */}
      <g transform="translate(15 34) skewY(26.565)">
        <rect x="5.5" y="9" width="19" height="13.5" rx="1.5" fill="#f8fafc" />
        <rect x="8" y="12" width="14" height="1.8" rx="0.9" fill="#c3d0e4" />
        <rect x="8" y="15.5" width="10" height="1.8" rx="0.9" fill="#c3d0e4" />
        <rect x="8" y="19" width="12" height="1.8" rx="0.9" fill="#c3d0e4" />
        <rect x="18.5" y="15.5" width="4" height="4" rx="0.8" fill="#4F7EF7" />
      </g>

      {/* flowin watermark on the shaded face */}
      <g transform="translate(45 49) skewY(-26.565)">
        <circle cx="12" cy="15" r="5" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2.2" fill="none" />
        <rect x="19.5" y="9.5" width="3.4" height="11" rx="1.7" fill="#ffffff" opacity="0.4" />
      </g>

      <path d="M80 16 l1.1 2.7 2.7 1.1 -2.7 1.1 -1.1 2.7 -1.1 -2.7 -2.7 -1.1 2.7 -1.1 Z" fill="#4F7EF7" opacity="0.55" />
    </svg>
  )
}
