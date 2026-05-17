'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

type AgentState = 'pending' | 'running' | 'complete';
type Stage = 'analyzer' | 'critic' | 'improver' | 'evaluator';

const STAGES: { id: Stage; label: string; result: string }[] = [
    { id: 'analyzer',  label: 'Analyzer',  result: '1 finding' },
    { id: 'critic',    label: 'Critic',    result: 'kept · 1' },
    { id: 'improver',  label: 'Improver',  result: 'patched' },
    { id: 'evaluator', label: 'Evaluator', result: 'improved · 100' },
];

const TICK_MS = 3000;  // uniform tick — each state holds for this long

export function HeroVisual() {
    // 0..STAGES.length-1 → that stage is currently running
    // STAGES.length      → all complete (held for one tick, then resets)
    const [active, setActive] = useState<number>(0);

    useEffect(() => {
        const id = setInterval(() => {
            setActive((prev) => (prev + 1) % (STAGES.length + 1));
        }, TICK_MS);
        return () => clearInterval(id);
    }, []);

    const stateOf = (i: number): AgentState =>
        active === i ? 'running' : active > i ? 'complete' : 'pending';

    return (
        <div className="relative">
            {/* Ambient glow */}
            <div
                className="pointer-events-none absolute -inset-8 rounded-3xl bg-foreground/[0.04] blur-2xl animate-pulse-soft"
                aria-hidden
            />

            {/* Console card */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-card/80 shadow-2xl shadow-black/40 backdrop-blur">
                {/* macOS-style window chrome */}
                <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-2.5">
                    <div className="flex gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-inset ring-black/20" />
                        <span className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-inset ring-black/20" />
                        <span className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-inset ring-black/20" />
                    </div>
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        inferloop · review
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-70" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        live
                    </span>
                </div>

                {/* Code block with inline finding */}
                <div className="border-b border-border bg-background/40 px-5 py-4 font-mono text-[13px] leading-6">
                    <CodeLine
                        n={1}
                        text={
                            <>
                                <span className="text-violet-400">function</span>{' '}
                                <span className="text-sky-400">add</span>
                                <span className="text-muted-foreground">(</span>
                                <span className="text-amber-300">a</span>
                                <span className="text-muted-foreground">,</span>{' '}
                                <span className="text-amber-300">b</span>
                                <span className="text-muted-foreground">) {'{'}</span>
                            </>
                        }
                    />
                    <CodeLine
                        n={2}
                        highlight
                        text={
                            <span className="relative">
                                <span className="pl-4">
                                    <span className="text-violet-400">return</span>{' '}
                                    <span className="text-amber-300">a</span>{' '}
                                    <span className="text-rose-400">-</span>{' '}
                                    <span className="text-amber-300">b</span>
                                    <span className="text-muted-foreground">;</span>
                                </span>
                                <Badge
                                    className="ml-3 h-auto gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-widest text-rose-700 dark:text-rose-300 animate-pulse-soft"
                                >
                                    <span className="h-1 w-1 rounded-full bg-rose-400" />
                                    critical · bug
                                </Badge>
                            </span>
                        }
                    />
                    <CodeLine n={3} text={<span className="text-muted-foreground">{'}'}</span>} />
                </div>

                {/* Pipeline panel */}
                <div className="space-y-1.5 p-3">
                    {STAGES.map((s, i) => {
                        const st = stateOf(i);
                        const tone = TONES[st];
                        return (
                            <div
                                key={s.id}
                                className={[
                                    'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-all duration-300',
                                    tone.row,
                                ].join(' ')}
                            >
                                <div className="flex items-center gap-3">
                                    <StatusDot state={st} />
                                    <span className={`font-mono uppercase tracking-widest text-[10px] ${tone.index}`}>
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className={`font-mono font-medium ${tone.label}`}>{s.label}</span>
                                </div>
                                <span
                                    className={[
                                        'font-mono text-[10px] uppercase tracking-widest transition-opacity duration-300',
                                        st === 'complete' ? 'opacity-100 text-emerald-400' : 'opacity-0 text-muted-foreground',
                                    ].join(' ')}
                                >
                                    {s.result}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const TONES: Record<AgentState, { row: string; index: string; label: string }> = {
    pending: {
        row:   'border-border/60 bg-transparent opacity-50',
        index: 'text-muted-foreground',
        label: 'text-muted-foreground',
    },
    running: {
        row:   'border-foreground/30 bg-foreground/[0.06] shadow-[0_0_24px_-10px_rgba(255,255,255,0.25)]',
        index: 'text-foreground',
        label: 'text-foreground',
    },
    complete: {
        row:   'border-emerald-500/20 bg-emerald-500/[0.04]',
        index: 'text-emerald-400/80',
        label: 'text-foreground',
    },
};

function CodeLine({ n, text, highlight = false }: { n: number; text: React.ReactNode; highlight?: boolean }) {
    return (
        <div className={['flex items-baseline gap-4', highlight && 'rounded-sm bg-foreground/[0.04]'].filter(Boolean).join(' ')}>
            <span className="select-none text-muted-foreground/50 w-4 text-right">{n}</span>
            <span className="flex-1">{text}</span>
        </div>
    );
}

function StatusDot({ state }: { state: AgentState }) {
    if (state === 'running') {
        return (
            <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
            </span>
        );
    }
    if (state === 'complete') {
        return (
            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 text-background">
                <svg viewBox="0 0 8 8" className="h-1.5 w-1.5 fill-none stroke-current stroke-2">
                    <path d="M1.5 4.5 L3.2 6 L6.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }
    return <span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/40" />;
}
