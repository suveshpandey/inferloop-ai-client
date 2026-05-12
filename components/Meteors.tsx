// Animated diagonal-streak background. Pure CSS — no JS state, no Motion library.
// Each meteor is a thin gradient bar, rotated 45° and translated across the viewport
// by a `meteor` keyframe defined in globals.css. Staggered durations + delays make
// the field feel continuous instead of in lockstep.

const METEORS = [
    { top: '-5%',  left: '-10%', width: 160, duration: 13, delay: 0    },
    { top: '8%',   left: '-15%', width: 130, duration: 15, delay: 1.8  },
    { top: '-15%', left: '15%',  width: 180, duration: 12, delay: 3.4  },
    { top: '-3%',  left: '38%',  width: 140, duration: 14, delay: 5.0  },
    { top: '18%',  left: '-25%', width: 170, duration: 16, delay: 6.6  },
    { top: '-18%', left: '55%',  width: 120, duration: 11, delay: 8.2  },
    { top: '12%',  left: '5%',   width: 150, duration: 13, delay: 9.8  },
    { top: '-8%',  left: '-5%',  width: 135, duration: 14, delay: 11.4 },
    { top: '25%',  left: '-30%', width: 145, duration: 15, delay: 13.0 },
];

export function Meteors() {
    return (
        <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
        >
            {METEORS.map((m, i) => (
                <span
                    key={i}
                    className="animate-meteor absolute h-px bg-gradient-to-r from-transparent via-white to-transparent"
                    style={{
                        top: m.top,
                        left: m.left,
                        width: `${m.width}px`,
                        animationDuration: `${m.duration}s`,
                        animationDelay: `${m.delay}s`,
                        filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))',
                    }}
                />
            ))}
        </div>
    );
}
