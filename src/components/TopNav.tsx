import React from 'react';
import { PersonaLogo } from './PersonaLogo';
import { MainNavSection } from '../types';
import {
  nativeMinimize,
  nativeToggleMaximize,
  nativeClose,
  nativeStartDragging,
} from '../lib/tauriWindow';

interface TopNavProps {
  currentSection: MainNavSection;
  onSelectSection: (section: MainNavSection) => void;
  onLogoClick?: () => void;
  isMaximized: boolean;
  isFullscreen?: boolean;
  onToggleMaximize?: () => void;
}

/* Authentic Windows 11 / 10 titlebar vector icons */
const MinimizeIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
    <path d="M0 5H10" strokeWidth="1" />
  </svg>
);

/* Windowed mode: exactly 1 single square (indicates "Maximize" / "Развернуть") */
const MaximizeIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
    <rect x="0.75" y="0.75" width="8.5" height="8.5" strokeWidth="1" />
  </svg>
);

/* Maximized / Fullscreen mode: exactly 2 overlapping squares (indicates "Restore Down" / "Свернуть в окно") */
const RestoreIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
    {/* Upper-right back square */}
    <path d="M2.5 2H8.25V7.75" strokeWidth="1" strokeLinecap="square" />
    {/* Lower-left front square */}
    <rect x="0.75" y="2.75" width="6.5" height="6.5" strokeWidth="1" fill="#0c0c0c" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
    <path d="M1 1L9 9M9 1L1 9" strokeWidth="1" strokeLinecap="square" />
  </svg>
);

export const TopNav: React.FC<TopNavProps> = ({
  currentSection,
  onSelectSection,
  onLogoClick,
  isMaximized,
  isFullscreen = false,
  onToggleMaximize,
}) => {
  const handleMinimize = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.blur();
    await nativeMinimize();
  };

  const handleToggleMaximize = async (e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.blur();
      }
    }
    await nativeToggleMaximize();
    if (onToggleMaximize) {
      onToggleMaximize();
    }
  };

  const handleClose = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.blur();
    await nativeClose();
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (isFullscreen) return;
    if (e.button !== 0 || e.detail > 1) return;
    if ((e.target as HTMLElement).closest('button, nav, a, input, [data-no-drag]')) {
      return;
    }
    nativeStartDragging();
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (isFullscreen) return;
    // Only double click if not on interactive elements
    if ((e.target as HTMLElement).closest('button, nav, a, input, [data-no-drag]')) {
      return;
    }
    handleToggleMaximize(e);
  };

  return (
    <header
      onMouseDown={handleHeaderMouseDown}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onDoubleClick={handleHeaderDoubleClick}
      className="sticky top-0 z-40 w-full h-11 border-b border-white/[0.08] bg-[#0c0c0c] select-none flex items-stretch justify-between cursor-default shrink-0"
    >
      {/* Left: Persona Brand (1 icon + 1 title) + Section Nav */}
      <div
        className="flex items-center gap-4 sm:gap-6 px-3 sm:px-4 h-full shrink-0"
      >
        {/* Brand */}
        <button
          onClick={onLogoClick || (() => onSelectSection('subjects'))}
          className="flex items-center gap-2.5 group focus:outline-none py-1 shrink-0 cursor-pointer"
          aria-label="Persona"
          data-no-drag
        >
          <div className="transition-transform duration-200 group-hover:scale-105">
            <PersonaLogo size={20} glow />
          </div>
          <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-white/90 group-hover:text-white transition-colors select-none">
            Persona
          </span>
        </button>

        {/* Navigation */}
        <nav className="flex items-center gap-1 h-full" data-no-drag>
          <button
            onClick={() => onSelectSection('subjects')}
            className={`relative px-3 py-1 text-xs transition-colors rounded font-medium select-none cursor-pointer ${
              currentSection === 'subjects'
                ? 'text-white bg-white/[0.08]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            Предметы
            {currentSection === 'subjects' && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => onSelectSection('calendar')}
            className={`relative px-3 py-1 text-xs transition-colors rounded font-medium select-none cursor-pointer ${
              currentSection === 'calendar'
                ? 'text-white bg-white/[0.08]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            Календарь
            {currentSection === 'calendar' && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => onSelectSection('board')}
            className={`relative px-3 py-1 text-xs transition-colors rounded font-medium select-none cursor-pointer ${
              currentSection === 'board'
                ? 'text-white bg-white/[0.08]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            Доска
            {currentSection === 'board' && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* Center: Draggable Spacer (clean desktop titlebar drag region when not in F11) */}
      <div
        className="flex-1 h-full cursor-default"
      />

      {/* Right: Authentic Desktop Window Controls (hidden in F11 Fullscreen mode) */}
      {!isFullscreen && (
        <div className="flex items-stretch h-full select-none cursor-default" data-no-drag>
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
            title="Свернуть"
            aria-label="Свернуть"
          >
            <MinimizeIcon />
          </button>

          {/* Maximize / Restore:
              - Windowed mode: 1 square (Maximize)
              - Maximized mode: 2 overlapping squares (Restore Down)
          */}
          <button
            onClick={handleToggleMaximize}
            className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
            title={isMaximized ? 'Свернуть в окно' : 'Развернуть'}
            aria-label={isMaximized ? 'Свернуть в окно' : 'Развернуть'}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>

          {/* Close (Native Windows Red Hover) */}
          <button
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#e81123] transition-colors focus:outline-none cursor-pointer"
            title="Закрыть"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </header>
  );
};
