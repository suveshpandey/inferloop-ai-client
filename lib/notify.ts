// Centralized notification helpers. Every error/success surface in the app
// funnels through here so we get one consistent format, one place to tweak
// duration/positioning, and zero stray `toast.error(msg)` calls scattered
// across the codebase.

import { toast } from 'sonner';
import { ApiRequestError } from './api';

type NotifyOpts = {
    /** Override the default duration (ms). */
    duration?: number;
    /** Optional secondary line under the main message. */
    description?: string;
};

/**
 * Surface an error to the user as a bottom-right toast.
 * Accepts an Error, ApiRequestError, string, or unknown — normalizes everything
 * into a clean message so callers don't have to branch on the error type.
 */
export function notifyError(err: unknown, opts: NotifyOpts = {}): void {
    const message = errorMessage(err);
    toast.error(message, {
        description: opts.description,
        duration:    opts.duration ?? 5000,
    });
}

export function notifySuccess(message: string, opts: NotifyOpts = {}): void {
    toast.success(message, {
        description: opts.description,
        duration:    opts.duration ?? 3500,
    });
}

export function notifyInfo(message: string, opts: NotifyOpts = {}): void {
    toast(message, {
        description: opts.description,
        duration:    opts.duration ?? 3500,
    });
}

// ─────────────────────────── internal helpers ──────────────────────────────

function errorMessage(err: unknown): string {
    if (err instanceof ApiRequestError) return err.message;
    if (err instanceof Error)            return err.message;
    if (typeof err === 'string')         return err;
    return 'Something went wrong. Please try again.';
}
