// Display helpers for user identity. Kept in one place so the avatar initials
// in the header, the dropdown, and the profile page all derive the same way.

export function initialsFromIdentity(username: string | null | undefined, email: string): string {
    const source = username?.trim() || email.split('@')[0] || '';
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.slice(0, 2).toUpperCase() || '??';
}

export function formatJoinedDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
