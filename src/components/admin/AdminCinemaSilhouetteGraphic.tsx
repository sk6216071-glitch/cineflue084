import React from 'react';

/**
 * High-definition dark cinematic Batman profile graphic with ambient cyan & crimson rim lighting.
 * Facing LEFT towards the welcome text, 1:1 match to media_1791215309457.png.
 */
export const AdminCinemaSilhouetteGraphic: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 540 320"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMaxYMid slice"
      >
        <defs>
          {/* Ambient Cold Cyan Rim Light from Left/Front */}
          <radialGradient id="cyanBacklight" cx="30%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="80%" stopColor="#1e3a8a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Crimson / Deep Red Gotham City Reflections from Right */}
          <radialGradient id="crimsonCityGlow" cx="80%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
            <stop offset="35%" stopColor="#e11d48" stopOpacity="0.3" />
            <stop offset="70%" stopColor="#881337" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Silhouette Matte Surface Gradient */}
          <linearGradient id="batmanMatte" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#0c1220" stopOpacity="0.98" />
            <stop offset="50%" stopColor="#070b14" stopOpacity="1" />
            <stop offset="100%" stopColor="#030508" stopOpacity="1" />
          </linearGradient>

          {/* Cold Cyan Rim Light Stroke */}
          <linearGradient id="cyanRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
          </linearGradient>

          {/* Crimson City Reflection Rim Stroke */}
          <linearGradient id="crimsonRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#e11d48" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#9f1239" stopOpacity="0.15" />
          </linearGradient>

          {/* Left card vignette fade */}
          <linearGradient id="cardTextMask" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#090d18" stopOpacity="1" />
            <stop offset="45%" stopColor="#090d18" stopOpacity="0.85" />
            <stop offset="75%" stopColor="#090d18" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#090d18" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Volumetric Atmosphere Blooms */}
        <circle cx="280" cy="140" r="180" fill="url(#cyanBacklight)" />
        <circle cx="450" cy="110" r="170" fill="url(#crimsonCityGlow)" />

        {/* 2. Distant Gotham City Skyline */}
        <g opacity="0.15">
          <rect x="260" y="140" width="14" height="180" fill="#38bdf8" />
          <rect x="282" y="110" width="18" height="210" fill="#0284c7" />
          <rect x="306" y="155" width="12" height="165" fill="#38bdf8" />
          <rect x="325" y="85" width="22" height="235" fill="#0369a1" />
          <rect x="420" y="120" width="18" height="200" fill="#f43f5e" />
          <rect x="445" y="95" width="24" height="225" fill="#e11d48" />
          <rect x="475" y="140" width="16" height="180" fill="#be123c" />
          <rect x="500" y="105" width="28" height="215" fill="#9f1239" />
        </g>

        {/* 3. The Batman (2022) Profile Silhouette - Facing LEFT */}
        {/* Cape & Back Trapezius */}
        <path
          d="M 370 170 C 400 175, 440 210, 480 250 C 505 275, 525 300, 540 320 L 410 320 C 390 280, 380 230, 370 170 Z"
          fill="#05070c"
        />

        {/* Tactical Body & Chest Armor */}
        <path
          d="M 260 320 C 275 270, 300 230, 335 195 L 355 175 L 385 180 L 415 230 L 410 320 Z"
          fill="url(#batmanMatte)"
        />

        {/* High Tactical Armored Collar */}
        <path
          d="M 325 180 L 335 155 L 358 152 L 370 162 L 365 190 L 338 188 Z"
          fill="#070a12"
          stroke="#1e293b"
          strokeWidth="0.8"
        />

        {/* Cowl with Pointed Bat Ears - Profile Facing LEFT */}
        <path
          d="M 368 152
             C 375 130, 372 105, 365 85
             L 360 45
             L 350 75
             C 342 72, 332 72, 325 76
             L 318 42
             L 314 78
             C 302 92, 296 108, 294 122
             L 302 124
             C 300 130, 298 136, 302 140
             L 312 138
             L 310 148
             C 314 153, 322 155, 330 154
             L 338 152
             Z"
          fill="#04060b"
        />

        {/* Cowl Eye Slot & Forehead Shadow */}
        <path
          d="M 314 120 L 302 122 L 305 130 L 312 132 Z"
          fill="#020306"
        />

        {/* FRONT RIM LIGHT (Cold Cyan Moonlight from Left illuminating Brow, Nose, Chin, Chest) */}
        <path
          d="M 318 42 L 314 78 C 302 92, 296 108, 294 122 L 302 124 C 300 130, 298 136, 302 140 L 312 138 L 310 148 C 314 153, 322 155, 330 154 L 335 175 C 300 215, 275 260, 260 320"
          stroke="url(#cyanRimGrad)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* BACK RIM LIGHT (Warm Crimson Gotham City Reflections from Right) */}
        <path
          d="M 360 45 L 365 85 C 372 105, 375 130, 368 152 L 370 170 C 400 175, 440 210, 480 250 C 505 275, 525 300, 540 320"
          stroke="url(#crimsonRimGrad)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Chest Plate Tactical Seam Highlights */}
        <path
          d="M 335 195 L 315 235 L 280 270"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
        <path
          d="M 350 205 L 375 240 L 415 275"
          stroke="#f43f5e"
          strokeWidth="1.2"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />

        {/* 4. Left Seamless Vignette Gradient */}
        <rect x="0" y="0" width="280" height="320" fill="url(#cardTextMask)" />
      </svg>
    </div>
  );
};
