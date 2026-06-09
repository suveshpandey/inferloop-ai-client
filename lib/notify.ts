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
    /** Optional clickable action button on the right side of the toast. */
    action?: { label: string; onClick: () => void };
};

/**
 * Surface an error to the user as a bottom-right toast.
 * Accepts an Error, ApiRequestError, string, or unknown — normalizes everything
 * into a clean message so callers don't have to branch on the error type.
 */
export function notifyError(err: unknown, opts: NotifyOpts = {}): void {
    const message = errorMessage(err);
    const rateLimited = err instanceof ApiRequestError && err.status === 429;
    const description = rateLimited
        ? rateLimitDescription(err)
        : (opts.description ?? rateLimitDescription(err));

    toast.error(message, {
        description,
        duration: rateLimited || description ? 7000 : opts.duration ?? 5000,
    });
}

export function notifySuccess(message: string, opts: NotifyOpts = {}): void {
    toast.success(message, {
        description: opts.description,
        duration:    opts.duration ?? 3500,
        action:      opts.action,
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

function rateLimitDescription(err: unknown): string | undefined {
    if (!(err instanceof ApiRequestError) || err.status !== 429) return undefined;
    if (err.retryAfter === undefined) return undefined;

    const seconds = err.retryAfter;
    if (seconds < 60) {
        return `You can try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
    }
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
        return `You can try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    const hours = Math.ceil(minutes / 60);
    return `You can try again in ${hours} hour${hours === 1 ? '' : 's'}.`;
}
