import React from 'react';

/**
 * High-definition SVG illustration of a vintage 35mm Cinema Film Reel
 * in 3D perspective with luminous amber lighting and winding film strip,
 * faithfully matching the CineFuel Control Center aesthetic.
 */
export const AdminFilmReelGraphic: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative pointer-events-none select-none overflow-visible ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 540 440"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Ambient Warm Golden Glow */}
          <radialGradient id="reelAmbientGlow" cx="62%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#d97706" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#ea580c" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Projector Light Cone */}
          <linearGradient id="projectorBeam" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          {/* Metallic Gold / Copper Outer Rim Gradient */}
          <linearGradient id="metallicRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="15%" stopColor="#f59e0b" />
            <stop offset="40%" stopColor="#78350f" />
            <stop offset="65%" stopColor="#fbbf24" />
            <stop offset="85%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>

          {/* Inner Rim Bevel */}
          <linearGradient id="innerBevel" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="50%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Wound Celluloid Film Gradient */}
          <radialGradient id="woundFilm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="60%" stopColor="#292524" />
            <stop offset="85%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#451a03" />
          </radialGradient>

          {/* Trailing Film Ribbon Gradient */}
          <linearGradient id="filmRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#292524" />
            <stop offset="50%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#0c0a09" />
          </linearGradient>

          {/* Golden Highlight Rim Line */}
          <linearGradient id="goldHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* 1. Deep Ambient Lighting Bloom */}
        <circle cx="340" cy="210" r="210" fill="url(#reelAmbientGlow)" />

        {/* 2. Soft Projector Light Ray Beams */}
        <polygon points="540,60 160,340 180,440 540,160" fill="url(#projectorBeam)" opacity="0.6" />

        {/* 3. The 3D Tilted Cinema Film Reel (Grouped in perspective rotation) */}
        <g transform="translate(330, 205) rotate(-16) scale(1.05, 0.94)">
          {/* Back Flange Shadow & Thickness */}
          <ellipse cx="6" cy="10" rx="158" ry="158" fill="#180e04" opacity="0.8" />
          <ellipse cx="4" cy="8" rx="156" ry="156" stroke="url(#innerBevel)" strokeWidth="6" opacity="0.6" />

          {/* Wound Celluloid Film Spool Block (Inner core) */}
          <ellipse cx="0" cy="0" rx="122" ry="122" fill="url(#woundFilm)" stroke="#451a03" strokeWidth="2" />
          {/* Concentric winding film rings */}
          <ellipse cx="0" cy="0" rx="112" ry="112" stroke="#292524" strokeWidth="1.5" strokeDasharray="12 4" opacity="0.6" />
          <ellipse cx="0" cy="0" rx="100" ry="100" stroke="#44403c" strokeWidth="1.5" opacity="0.5" />
          <ellipse cx="0" cy="0" rx="88" ry="88" stroke="#292524" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.7" />
          <ellipse cx="0" cy="0" rx="76" ry="76" stroke="#44403c" strokeWidth="1.5" opacity="0.5" />
          <ellipse cx="0" cy="0" rx="64" ry="64" stroke="#78350f" strokeWidth="2" opacity="0.7" />

          {/* Front Flange Outer Plate */}
          <ellipse cx="0" cy="0" rx="156" ry="156" stroke="url(#metallicRim)" strokeWidth="14" />
          <ellipse cx="0" cy="0" rx="149" ry="149" stroke="#fef3c7" strokeWidth="1" opacity="0.4" />
          <ellipse cx="0" cy="0" rx="163" ry="163" stroke="#b45309" strokeWidth="2" opacity="0.6" />

          {/* Spoke Holes / Perforated Windows on the Reel Face (5 cutouts) */}
          {[0, 72, 144, 216, 288].map((angle, idx) => {
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * 94;
            const y = Math.sin(rad) * 94;
            return (
              <g key={idx} transform={`translate(${x}, ${y}) rotate(${angle + 90})`}>
                {/* Spoke Cutout Window */}
                <path
                  d="M -18,-18 C -10,-28 10,-28 18,-18 C 24,-2 18,22 10,26 C 2,28 -2,28 -10,26 C -18,22 -24,-2 -18,-18 Z"
                  fill="#0b0c10"
                  stroke="url(#metallicRim)"
                  strokeWidth="3.5"
                />
                <path
                  d="M -15,-15 C -8,-24 8,-24 15,-15 C 20,-1 15,19 8,22 C 2,24 -2,24 -8,22 C -15,19 -20,-1 -15,-15 Z"
                  stroke="url(#innerBevel)"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
              </g>
            );
          })}

          {/* Center Hub Core */}
          <ellipse cx="0" cy="0" rx="42" ry="42" fill="url(#woundFilm)" stroke="url(#metallicRim)" strokeWidth="6" />
          <ellipse cx="0" cy="0" rx="36" ry="36" stroke="#fbbf24" strokeWidth="1.5" opacity="0.7" />

          {/* Central Axle Spindle Hole */}
          <circle cx="0" cy="0" r="14" fill="#090a0f" stroke="url(#metallicRim)" strokeWidth="4" />
          {/* Spindle Keyway notches */}
          <rect x="-2" y="-18" width="4" height="6" fill="url(#metallicRim)" />
          <rect x="-2" y="12" width="4" height="6" fill="url(#metallicRim)" />

          {/* Outer Rim Light Flares */}
          <circle cx="95" cy="-120" r="3.5" fill="#fef08a" opacity="0.9" filter="drop-shadow(0 0 6px #f59e0b)" />
          <circle cx="-130" cy="80" r="2.5" fill="#fef08a" opacity="0.7" filter="drop-shadow(0 0 4px #f59e0b)" />
          <circle cx="140" cy="60" r="3" fill="#fbbf24" opacity="0.8" filter="drop-shadow(0 0 5px #f59e0b)" />
        </g>

        {/* 4. Curving 35mm Film Ribbon Winding Off the Reel Spool */}
        <g opacity="0.9">
          {/* Film Strip Path Base */}
          <path
            d="M 280,290 C 220,330 160,335 110,380 C 80,405 50,420 10,435"
            stroke="url(#filmRibbon)"
            strokeWidth="38"
            strokeLinecap="round"
          />
          {/* Film Strip Border Edges */}
          <path
            d="M 280,271 C 220,311 160,316 110,361 C 80,386 50,401 10,416"
            stroke="url(#goldHighlight)"
            strokeWidth="2"
            opacity="0.7"
          />
          <path
            d="M 280,309 C 220,349 160,354 110,399 C 80,424 50,439 10,454"
            stroke="#78350f"
            strokeWidth="2"
            opacity="0.8"
          />

          {/* Sprocket Perforation Holes along top track */}
          {[
            { cx: 260, cy: 284 },
            { cx: 235, cy: 298 },
            { cx: 210, cy: 312 },
            { cx: 185, cy: 326 },
            { cx: 160, cy: 342 },
            { cx: 135, cy: 360 },
            { cx: 110, cy: 378 },
            { cx: 85, cy: 396 },
            { cx: 60, cy: 412 },
            { cx: 35, cy: 426 },
          ].map((pt, i) => (
            <rect
              key={`spkt-top-${i}`}
              x={pt.cx - 2.5}
              y={pt.cy - 4}
              width="5"
              height="8"
              rx="1.5"
              fill="#08090d"
              stroke="#b45309"
              strokeWidth="1"
              opacity="0.85"
            />
          ))}

          {/* Sprocket Perforation Holes along bottom track */}
          {[
            { cx: 270, cy: 304 },
            { cx: 245, cy: 318 },
            { cx: 220, cy: 332 },
            { cx: 195, cy: 346 },
            { cx: 170, cy: 362 },
            { cx: 145, cy: 380 },
            { cx: 120, cy: 398 },
            { cx: 95, cy: 416 },
            { cx: 70, cy: 432 },
            { cx: 45, cy: 446 },
          ].map((pt, i) => (
            <rect
              key={`spkt-bot-${i}`}
              x={pt.cx - 2.5}
              y={pt.cy - 4}
              width="5"
              height="8"
              rx="1.5"
              fill="#08090d"
              stroke="#b45309"
              strokeWidth="1"
              opacity="0.85"
            />
          ))}

          {/* Individual Frames / Film Dividers */}
          {[
            { x1: 248, y1: 290, x2: 254, y2: 312 },
            { x1: 198, y1: 320, x2: 204, y2: 342 },
            { x1: 148, y1: 350, x2: 154, y2: 374 },
            { x1: 98, y1: 386, x2: 104, y2: 410 },
          ].map((line, i) => (
            <line
              key={`frame-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#44403c"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          ))}
        </g>

        {/* 5. Cinema Atmosphere Sparks / Floating Glow Dust */}
        <circle cx="210" cy="140" r="1.5" fill="#fef08a" opacity="0.8" />
        <circle cx="260" cy="110" r="2" fill="#fbbf24" opacity="0.6" />
        <circle cx="390" cy="90" r="1.5" fill="#fde047" opacity="0.7" />
        <circle cx="460" cy="170" r="2" fill="#f59e0b" opacity="0.5" />
        <circle cx="430" cy="270" r="1.5" fill="#fbbf24" opacity="0.6" />
        <circle cx="310" cy="340" r="2" fill="#fde047" opacity="0.8" />
      </svg>
    </div>
  );
};

export default AdminFilmReelGraphic;
