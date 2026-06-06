'use client';

// Reusable confirmation dialog. Centered modal with backdrop, Esc-to-cancel,
// body-scroll lock, and a confirm button that shows a spinner while loading.
// Call sites pass `open` + `onCancel` + `onConfirm`; the dialog owns nothing
// about what's being confirmed.

import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    loadingLabel?: string;
    loading?: boolean;
    // Destructive uses the Button's tinted destructive variant — readable in
    // both light and dark themes. Default uses the primary variant.
    confirmVariant?: 'destructive' | 'default';
    onCancel: () => void;
    onConfirm: () => void;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    loadingLabel = 'Working…',
    loading      = false,
    confirmVariant = 'default',
    onCancel,
    onConfirm,
}: ConfirmDialogProps) {
    // Esc closes — but only when an action isn't in flight, so the user
    // can't half-cancel a delete mid-request.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, loading, onCancel]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
            <div
                onClick={loading ? undefined : onCancel}
                aria-hidden
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-lg">
                <h2
                    id="confirm-dialog-title"
                    className="font-mono text-xs uppercase tracking-widest text-foreground"
                >
                    {title}
                </h2>
                {description && (
                    <div className="mt-3 text-sm text-foreground">{description}</div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={confirmVariant}
                        onClick={onConfirm}
                        disabled={loading}
                        className="min-w-[6rem]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <Spinner size="sm" />
                                {loadingLabel}
                            </span>
                        ) : (
                            confirmLabel
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
