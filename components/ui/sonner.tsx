'use client';

// Sonner Toaster wrapped to match shadcn theming. The layout is always dark
// in this app, so we pin `theme="dark"` rather than reading from next-themes.
// CSS variables map sonner's slots to our existing palette so toasts blend
// with Card/Border/Foreground tokens instead of bringing their own colors.

import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
    return (
        <Sonner
            theme="dark"
            position="bottom-right"
            duration={4500}
            closeButton
            // richColors=true is what makes sonner branch on toast type and
            // apply the --error-*/--success-* CSS vars below. Without it,
            // every toast falls back to --normal-* and shows up neutral.
            richColors
            toastOptions={{
                classNames: {
                    toast:        'font-mono text-sm shadow-lg',
                    description:  'opacity-80',
                    actionButton: 'bg-primary text-primary-foreground',
                    cancelButton: 'bg-muted text-muted-foreground',
                },
            }}
            style={
                {
                    // Default ("info" / plain) toast — uses the card palette.
                    '--normal-bg':      'var(--card)',
                    '--normal-text':    'var(--card-foreground)',
                    '--normal-border':  'var(--border)',

                    // Error toast — app-themed red. Darker base with bright red
                    // border + foreground so it reads urgent without clashing
                    // with the dark UI. Uses oklch so it tracks the rest of the
                    // palette instead of looking like a foreign Tailwind tone.
                    '--error-bg':      'oklch(0.28 0.08 22)',
                    '--error-text':    'oklch(0.93 0.04 22)',
                    '--error-border':  'oklch(0.55 0.18 22)',

                    // Success — leave emerald-ish for contrast against error.
                    '--success-bg':     'oklch(0.26 0.07 155)',
                    '--success-text':   'oklch(0.93 0.05 155)',
                    '--success-border': 'oklch(0.55 0.15 155)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}
