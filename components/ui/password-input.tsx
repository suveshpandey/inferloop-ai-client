'use client';

// Password field with an eye-toggle. Wraps the base Input so it inherits all
// styling and forwards every prop; only the `type` is owned internally. The
// toggle button sits inside the input via right-padding + absolute positioning
// so the field reads as one element rather than [input][button].

import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
    function PasswordInput({ className, disabled, ...rest }, ref) {
        const [visible, setVisible] = useState(false);
        const Icon = visible ? EyeOff : Eye;
        const label = visible ? 'Hide password' : 'Show password';

        return (
            <div className="relative">
                <Input
                    ref={ref}
                    type={visible ? 'text' : 'password'}
                    disabled={disabled}
                    // Reserve room on the right edge so the typed text never
                    // slides under the toggle button.
                    className={cn('pr-10', className)}
                    {...rest}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    disabled={disabled}
                    aria-label={label}
                    aria-pressed={visible}
                    title={label}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Icon className="h-4 w-4" />
                </button>
            </div>
        );
    },
);
