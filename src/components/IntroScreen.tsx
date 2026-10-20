import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { PersonaLogo } from './PersonaLogo';

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  // Phase 0: Logo alone in center
  // Phase 1: Logo glides left & letters emerge out of the logo
  // Phase 2: Full lockup formed + short quiet pause
  // Phase 3: Transition out
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    // 1.1s: start revealing letters from the logo
    const t1 = setTimeout(() => {
      setPhase(1);
    }, 1100);

    // 2.7s: lockup fully assembled, calm pause
    const t2 = setTimeout(() => {
      setPhase(2);
    }, 2700);

    // 3.6s: transition to app
    const t3 = setTimeout(() => {
      onComplete();
    }, 3600);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') return;
      onComplete();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  const letters = ['P', 'e', 'r', 's', 'o', 'n', 'a'];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer select-none overflow-hidden"
    >
      {/* Subtle ambient light field */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: phase >= 1 ? 0.35 : 0.2, scale: phase >= 1 ? 1.2 : 0.9 }}
        transition={{ duration: 1.8, ease: 'easeOut' }}
        className="absolute w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.015) 45%, transparent 70%)',
        }}
      />

      {/* The Central Composition */}
      <div className="relative flex items-center justify-center z-10">
        {/* Animated Row Container */}
        <motion.div
          className="flex items-center"
          animate={{
            x: phase >= 1 ? -4 : 0,
          }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Logo: initially centered, then shifts slightly to give birth to the letters */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, filter: 'blur(3px)' }}
            animate={{
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              x: phase >= 1 ? 0 : 0,
            }}
            transition={{
              duration: 1.0,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative text-white shrink-0 z-20"
          >
            <PersonaLogo size={76} glow={phase >= 1} color="#ffffff" />
          </motion.div>

          {/* Masked reveal container: letters emerge OUT of the logo to the right */}
          <div className="relative overflow-hidden pl-5 py-2 flex items-center">
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: phase >= 1 ? 'auto' : 0,
                opacity: phase >= 1 ? 1 : 0,
              }}
              transition={{
                duration: 1.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center overflow-hidden"
            >
              {letters.map((letter, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, x: -35 }}
                  animate={{
                    opacity: phase >= 1 ? 1 : 0,
                    x: phase >= 1 ? 0 : -35,
                  }}
                  transition={{
                    duration: 0.85,
                    delay: phase >= 1 ? 0.08 * index : 0,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="text-4xl sm:text-5xl font-light text-white tracking-[0.16em] inline-block select-none"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.div>

            {/* Subtle soft edge gradient mask right where letters exit the logo */}
            {phase === 1 && (
              <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
                className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)',
                }}
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Footer Info: developed by NRT and hint */}
      <div className="absolute bottom-7 flex flex-col items-center gap-1.5 select-none pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: phase >= 1 ? 0.75 : 0.4 }}
          transition={{ delay: 0.6, duration: 1.0 }}
          className="text-xs font-mono tracking-[0.22em] text-neutral-400 uppercase font-medium"
        >
          developed by NRT
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ delay: 2.2, duration: 0.8 }}
          className="text-[10px] font-mono tracking-widest text-neutral-600 uppercase"
        >
          Нажмите любую клавишу для перехода
        </motion.div>
      </div>
    </motion.div>
  );
};
