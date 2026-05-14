'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { initialsFromIdentity, formatJoinedDate } from '@/lib/user';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { LoadingState, Spinner } from '@/components/ui/spinner';

export default function ProfilePage() {
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (auth.status === 'unauthenticated') router.replace('/login');
    }, [auth.status, router]);

    if (auth.status !== 'authenticated') {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LoadingState label="Loading" />
            </div>
        );
    }

    const { email, username, createdAt } = auth.user;
    const displayName = username?.trim() || email.split('@')[0];
    const initials = initialsFromIdentity(username, email);

    const handleLogout = async () => {
        await auth.logout();
        router.replace('/login');
    };

    return (
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
            {/* ── Hero ───────────────────────────────────────────────── */}
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card font-mono text-2xl font-semibold uppercase tracking-wider">
                        {initials}
                    </div>
                    {/* Soft ambient ring — purely decorative. */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -m-2 rounded-full ring-1 ring-border/50"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Account
                    </p>
                    <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                        {displayName}
                    </h1>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {email}
                    </p>
                </div>
            </div>

            {/* ── Account details ────────────────────────────────────── */}
            <Section title="Details" description="Identity and account metadata.">
                <DetailList
                    items={[
                        { label: 'Username', value: username?.trim() || <Muted>Not set</Muted> },
                        { label: 'Email',    value: email },
                        { label: 'Joined',   value: formatJoinedDate(createdAt) },
                    ]}
                />
            </Section>

            {/* ── Security ───────────────────────────────────────────── */}
            <Section title="Security" description="Change your password. Minimum 8 characters.">
                <ChangePasswordForm />
            </Section>

            {/* ── Footer / sign out ──────────────────────────────────── */}
            <div className="mt-16 flex items-center justify-between border-t border-border pt-6">
                <div>
                    <p className="text-sm font-medium">Sign out of this session</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        You&apos;ll need to log in again to access your reviews.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <LogOut className="h-4 w-4" />
                    Log out
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

// Section: title + description on the left, content on the right at lg+.
// Stacks on mobile. Top border separates from the previous block — quieter
// than wrapping each block in a Card.
function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-12 grid gap-6 border-t border-border pt-8 lg:grid-cols-[14rem_1fr] lg:gap-10">
            <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">
                    {title}
                </h2>
                {description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}

function Muted({ children }: { children: React.ReactNode }) {
    return <span className="text-muted-foreground">{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────

// Borderless list of label/value pairs. Labels in a fixed column so every
// value starts at the same x-position.
function DetailList({
    items,
}: {
    items: Array<{ label: string; value: React.ReactNode }>;
}) {
    return (
        <dl className="divide-y divide-border/60">
            {items.map((it) => (
                <div
                    key={it.label}
                    className="grid grid-cols-[8rem_1fr] items-baseline gap-4 py-3 first:pt-0 last:pb-0"
                >
                    <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {it.label}
                    </dt>
                    <dd className="truncate text-sm">{it.value}</dd>
                </div>
            ))}
        </dl>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChangePasswordForm() {
    const [currentPassword, setCurrent] = useState('');
    const [newPassword, setNew] = useState('');
    const [confirmPassword, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setCurrent('');
        setNew('');
        setConfirm('');
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            notifyError(new Error('Password must be at least 8 characters'));
            return;
        }
        if (newPassword !== confirmPassword) {
            notifyError(new Error('New passwords do not match'));
            return;
        }
        if (newPassword === currentPassword) {
            notifyError(new Error('New password must differ from current password'));
            return;
        }

        setSubmitting(true);
        try {
            await api.changePassword({ currentPassword, newPassword });
            notifySuccess('Password updated');
            reset();
        } catch (err) {
            notifyError(err, { description: 'Could not update password. Check your current password and try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            <Field id="current-password" label="Current password">
                <PasswordInput
                    id="current-password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    disabled={submitting}
                />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
                <Field id="new-password" label="New password">
                    <PasswordInput
                        id="new-password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNew(e.target.value)}
                        minLength={8}
                        required
                        disabled={submitting}
                    />
                </Field>
                <Field id="confirm-password" label="Confirm">
                    <PasswordInput
                        id="confirm-password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirm(e.target.value)}
                        minLength={8}
                        required
                        disabled={submitting}
                    />
                </Field>
            </div>

            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting} className="min-w-[10rem]">
                    {submitting ? (
                        <span className="flex items-center gap-2">
                            <Spinner size="sm" />
                            Updating…
                        </span>
                    ) : (
                        'Update password'
                    )}
                </Button>
            </div>
        </form>
    );
}

// Tiny label+field wrapper so the security form rows align with the mono
// label styling used elsewhere on the page.
function Field({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label
                htmlFor={id}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
                {label}
            </Label>
            {children}
        </div>
    );
}

