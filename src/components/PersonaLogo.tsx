import React from 'react';

interface PersonaLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
  color?: string;
}

export const PersonaLogo: React.FC<PersonaLogoProps> = ({
  className = '',
  size = 22,
  glow = false,
  color = '#ffffff',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-xl pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
            transform: 'scale(1.8)',
          }}
        />
      )}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10"
      >
        {/* Outer head arch with nose slope and bridge */}
        <path
          d="M 23 58 C 23 34 38 20 60 20 C 72 20 81 27 86 38 L 94 56 L 81 56"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lower jaw and chin contour */}
        <path
          d="M 81 56 L 81 68 C 81 83 71 91 58 91 L 44 91"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left vertical stem with top hook (forms the spine of P) */}
        <path
          d="M 37 94 L 37 46 C 37 35 44 32 52 32 C 60 32 64 36 64 44 L 64 56"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Eye dot */}
        <circle cx="71" cy="46" r="4.2" fill={color} />
      </svg>
    </div>
  );
};
