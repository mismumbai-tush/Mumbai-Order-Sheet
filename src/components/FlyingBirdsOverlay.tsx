import React, { useEffect, useRef, useState } from 'react';

type FlightDirection = 'ltr' | 'rtl';

interface BirdSpec {
  id: number;
  topVh: number;
  sizePx: number;
  delayMs: number;
  durationSec: number;
  flapSec: number;
  shadeClass: string;
}

// Exactly 2 small, clean birds flying together
const FLOCK_SPECS: BirdSpec[] = [
  { id: 1, topVh: 22, sizePx: 30, delayMs: 0, durationSec: 9.2, flapSec: 0.48, shadeClass: 'text-slate-700/85' },
  { id: 2, topVh: 28, sizePx: 23, delayMs: 550, durationSec: 9.6, flapSec: 0.54, shadeClass: 'text-slate-600/80' }
];

const PASS_DURATION_MS = 10800;
const RETURN_PAUSE_MS = 1400;
const MIN_CYCLE_INTERVAL_MS = 60_000; // 1 minute
const MAX_CYCLE_INTERVAL_MS = 120_000; // 2 minutes

export const FlyingBirdsOverlay: React.FC = () => {
  const [flight, setFlight] = useState<{ key: number; direction: FlightDirection } | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const clearAllTimers = () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };

    const scheduleFlightCycle = (delayMs: number) => {
      const startTimer = setTimeout(() => {
        const baseKey = Date.now();
        // Pass 1: Left -> Right
        setFlight({ key: baseKey, direction: 'ltr' });

        // Pass 2: Right -> Left
        const rtlStartTimer = setTimeout(() => {
          setFlight({ key: baseKey + 1, direction: 'rtl' });

          const endTimer = setTimeout(() => {
            setFlight(null);
            // Next cycle between 1 and 2 minutes (60s - 120s)
            const nextDelay =
              MIN_CYCLE_INTERVAL_MS +
              Math.floor(Math.random() * (MAX_CYCLE_INTERVAL_MS - MIN_CYCLE_INTERVAL_MS));
            scheduleFlightCycle(nextDelay);
          }, PASS_DURATION_MS);
          timersRef.current.push(endTimer);
        }, PASS_DURATION_MS + RETURN_PAUSE_MS);

        timersRef.current.push(rtlStartTimer);
      }, delayMs);

      timersRef.current.push(startTimer);
    };

    scheduleFlightCycle(1500);

    return () => {
      clearAllTimers();
    };
  }, []);

  if (!flight) return null;

  const isRTL = flight.direction === 'rtl';

  return (
    <div
      key={flight.key}
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none print:hidden"
    >
      {FLOCK_SPECS.map((bird) => (
        <div
          key={bird.id}
          style={{
            top: `${bird.topVh}vh`,
            width: `${bird.sizePx}px`,
            height: `${Math.round(bird.sizePx * 0.66)}px`,
            animationName: isRTL ? 'birdFlyRTL' : 'birdFlyLTR',
            animationDuration: `${bird.durationSec}s`,
            animationDelay: `${bird.delayMs}ms`,
            animationTimingFunction: 'linear',
            animationFillMode: 'both'
          }}
          className="absolute left-0 will-change-transform"
        >
          <div
            style={{
              animationName: 'birdGlideBob',
              animationDuration: `${(bird.flapSec * 2.4).toFixed(2)}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite'
            }}
            className="w-full h-full"
          >
            <svg
              viewBox="0 0 48 32"
              className={`w-full h-full overflow-visible ${bird.shadeClass} ${isRTL ? '-scale-x-100' : ''}`}
            >
              {/* Back wing */}
              <path
                d="M23 16 Q16 7 8 5 Q14 11 19 17 Z"
                fill="currentColor"
                opacity="0.65"
                style={{
                  transformOrigin: '21px 16px',
                  animation: `birdWingBack ${bird.flapSec}s ease-in-out infinite alternate`
                }}
              />
              {/* Clean streamlined swallow/bird body */}
              <path
                d="M8 18 Q18 15 28 16 Q35 16 40 14 L44 15.5 L39 17.5 Q32 20 22 20 Q13 20 6 21 L2 19 Z"
                fill="currentColor"
              />
              {/* Front wing */}
              <path
                d="M27 16 Q21 5 11 3 Q18 10 23 17 Z"
                fill="currentColor"
                style={{
                  transformOrigin: '25px 16px',
                  animation: `birdWingFront ${bird.flapSec}s ease-in-out infinite alternate`
                }}
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};
