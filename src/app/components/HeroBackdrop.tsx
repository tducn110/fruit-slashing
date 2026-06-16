export function HeroBackdrop() {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5ecd7" />
          <stop offset="60%" stopColor="#f5ecd7" />
          <stop offset="100%" stopColor="#efe3c4" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8d68a" />
          <stop offset="100%" stopColor="#6b8e3d" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#sky)" />

      {/* Distant mountains */}
      <path d="M0,560 C200,520 400,580 700,540 C950,510 1180,580 1600,540 L1600,720 L0,720 Z"
        fill="#e6d8b2" opacity="0.7" />
      <path d="M0,560 C200,520 400,580 700,540 C950,510 1180,580 1600,540"
        fill="none" stroke="#8a7d65" strokeWidth="1.2" opacity="0.35" />

      {/* Mid hills */}
      <path d="M0,650 C260,620 520,700 820,640 C1100,590 1320,680 1600,630 L1600,800 L0,800 Z"
        fill="#d8c896" opacity="0.65" />

      {/* Field strokes (rice paddies) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <path key={`field-${i}`}
          d={`M0,${700 + i * 14} C300,${695 + i * 14} 800,${710 + i * 14} 1600,${698 + i * 14}`}
          stroke="#8a7d65" strokeWidth="0.7" fill="none" opacity="0.28" />
      ))}

      {/* Bamboo / palm strokes */}
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i / 17) * 1600 + (i % 3) * 12;
        const baseY = 660 + (i % 4) * 10;
        const h = 110 + (i % 5) * 24;
        return (
          <g key={`tree-${i}`} opacity="0.45">
            <path d={`M${x},${baseY} Q${x + 2},${baseY - h / 2} ${x + (i % 2 ? 4 : -4)},${baseY - h}`}
              stroke="#6b8e3d" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            {[0.3, 0.55, 0.8].map((t, k) => (
              <path key={k}
                d={`M${x},${baseY - h * t} l${(k % 2 ? -1 : 1) * 14},${-6 - k * 2}`}
                stroke="#6b8e3d" strokeWidth="1" fill="none" strokeLinecap="round" />
            ))}
          </g>
        );
      })}

      {/* Heron flock — distant V shapes */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = 200 + i * 160 + (i % 2 ? 30 : 0);
        const y = 240 + (i % 3) * 50;
        return (
          <path key={`bird-${i}`}
            d={`M${x},${y} l8,-6 l8,6 M${x + 16},${y} l8,-6 l8,6`}
            stroke="#8a7d65" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
        );
      })}

      {/* Foreground grass */}
      <path d="M0,780 C300,750 700,790 1100,760 C1350,745 1500,780 1600,765 L1600,900 L0,900 Z"
        fill="url(#grass)" />
      {/* Grass strokes */}
      {Array.from({ length: 60 }).map((_, i) => {
        const x = (i / 59) * 1600 + Math.sin(i) * 6;
        return (
          <path key={`grass-${i}`}
            d={`M${x},${800 + (i % 3) * 8} l${(i % 2 ? -1 : 1) * 3},-${10 + (i % 4) * 3}`}
            stroke="#4c6630" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.55" />
        );
      })}

      {/* Kite (small accent top) */}
      <g transform="translate(280,180) rotate(-12)">
        <polygon points="0,-30 22,0 0,30 -22,0" fill="#f0e6c2" stroke="#8a7d65" strokeWidth="1.2" />
        <line x1="-22" y1="0" x2="22" y2="0" stroke="#8a7d65" strokeWidth="0.6" />
        <line x1="0" y1="-30" x2="0" y2="30" stroke="#8a7d65" strokeWidth="0.6" />
        <path d="M0,30 q-4,30 6,60 q-12,20 -2,50" stroke="#8a7d65" strokeWidth="0.6" fill="none" />
      </g>
    </svg>
  );
}
