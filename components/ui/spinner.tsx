// Circular loading spinner used wherever we'd otherwise show raw "Loading…" text.
// SVG-based so it scales crisply at any size; uses `currentColor` so it inherits
// whatever text color the surrounding context provides (muted-foreground in most
// places, foreground inside buttons, etc.).

type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<SpinnerSize, number> = {
    sm: 14,
    md: 20,
    lg: 28,
};

const STROKE: Record<SpinnerSize, number> = {
    sm: 2.5,
    md: 2.5,
    lg: 3,
};

export function Spinner({
    size = 'md',
    className = '',
    'aria-label': ariaLabel = 'Loading',
}: {
    size?: SpinnerSize;
    className?: string;
    'aria-label'?: string;
}) {
    const px = SIZE_PX[size];
    const sw = STROKE[size];
    return (
        <svg
            className={`animate-spin ${className}`}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            fill="none"
            role="status"
            aria-label={ariaLabel}
        >
            {/* Track — full circle at low opacity. */}
            <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth={sw}
            />
            {/* Arc — a quarter of the circle at full opacity. CSS spin animation
                rotates the whole SVG, giving the classic "chasing tail" look. */}
            <path
                d="M 12 2 a 10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth={sw}
                strokeLinecap="round"
            />
        </svg>
    );
}

// Convenience: spinner + label in the same horizontal row, matching the app's
// `font-mono uppercase tracking-widest text-muted-foreground` voice. Use this
// for full-page or full-section loading states; use <Spinner /> alone inline.
export function LoadingState({
    label = 'Loading',
    size = 'md',
    className = '',
}: {
    label?: string;
    size?: SpinnerSize;
    className?: string;
}) {
    return (
        <div className={`flex items-center justify-center gap-3 text-muted-foreground ${className}`}>
            <Spinner size={size} />
            <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
        </div>
    );
}
