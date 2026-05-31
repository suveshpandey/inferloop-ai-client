import Link from 'next/link';

// Minimal site footer shared by the landing page and the public /how-it-works
// page. Intentionally sparse — brand + year on the left, a couple of links on
// the right, separated by a hairline border.

export function Footer() {
    return (
        <footer className="relative mx-auto max-w-6xl px-6 pb-8 pt-2">
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-5">
                <Link
                    href="/"
                    className="group flex items-baseline gap-0 font-mono text-[11px] tracking-tight text-muted-foreground transition-colors hover:text-foreground"
                >
                    <span>InferLoop</span>
                    <span className="opacity-60 group-hover:opacity-100">.ai</span>
                    <span className="ml-2 opacity-60">© {new Date().getFullYear()}</span>
                </Link>

                <nav className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                    <Link href="/how-it-works" className="transition-colors hover:text-foreground">
                        How it works
                    </Link>
                    <Link href="/login" className="transition-colors hover:text-foreground">
                        Log in
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
