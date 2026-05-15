'use client';

// Side-by-side / inline code diff using Monaco's DiffEditor. Renders the
// improved code panel on the review page — same red-removed / green-added
// language people see in VS Code, Cursor, and GitHub PRs. Theme + language
// mapping shared with the input Editor via lib/monaco-theme.ts.

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { DiffOnMount } from '@monaco-editor/react';
import { Check, X } from 'lucide-react';
import { LoadingState } from '@/components/ui/spinner';
import { useTheme } from '@/contexts/ThemeContext';
import {
    INFERLOOP_MONO_THEME,
    INFERLOOP_MONO_THEME_LIGHT,
    LANGUAGE_TO_MONACO,
    MONACO_DARK_THEME,
    MONACO_LIGHT_THEME,
} from '@/lib/monaco-theme';
import { notifySuccess } from '@/lib/notify';

// See CodeEditor.tsx for the rationale behind this dynamic chain: we bundle
// monaco-editor locally (via the explicit ESM entry, since the package root
// is an AMD bundle bundlers can't parse) and configure @monaco-editor/react's
// loader to use it, eliminating the runtime CDN fetch from jsdelivr.
const MonacoDiffEditor = dynamic(
    async () => {
        const monaco = await import('monaco-editor');
        const reactMonaco = await import('@monaco-editor/react');
        reactMonaco.loader.config({ monaco });
        return reactMonaco.DiffEditor;
    },
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[480px] items-center justify-center">
                <LoadingState label="Loading diff" />
            </div>
        ),
    },
);

type Decision = 'pending' | 'kept' | 'discarded';

type Props = {
    original: string;
    modified: string;
    language: string;
    height?: number;
    /** Called when the user accepts the improvement — caller should swap their
     *  editor buffer to `modified`. */
    onKeep?:    () => void;
    /** Called when the user rejects — caller should restore their buffer to
     *  `original` (or otherwise dismiss the suggestion). */
    onDiscard?: () => void;
};

export function DiffViewer({
    original,
    modified,
    language,
    height = 480,
    onKeep,
    onDiscard,
}: Props) {
    const monacoLang = LANGUAGE_TO_MONACO[language] ?? 'plaintext';
    const { theme } = useTheme();
    const activeTheme = theme === 'light' ? MONACO_LIGHT_THEME : MONACO_DARK_THEME;

    // Inline by default — our column is ~700px wide; a 2-pane side-by-side at
    // ~340px per pane gets cramped fast. User can flip via the toolbar.
    const [renderSideBySide, setRenderSideBySide] = useState(false);
    const [copied, setCopied] = useState(false);
    const [decision, setDecision] = useState<Decision>('pending');

    // Re-apply the theme when the app switches between light/dark without
    // tearing down the editor.
    const monacoRef = useRef<Parameters<DiffOnMount>[1] | null>(null);
    useEffect(() => {
        monacoRef.current?.editor.setTheme(activeTheme);
    }, [activeTheme]);

    // Reset the decision whenever a new improver result comes in. Otherwise
    // re-running a review would carry the previous Kept/Discarded state into
    // a fresh diff that may have nothing to do with the prior decision.
    useEffect(() => {
        setDecision('pending');
    }, [original, modified]);

    const handleKeep = () => {
        setDecision('kept');
        onKeep?.();
    };
    const handleDiscard = () => {
        setDecision('discarded');
        onDiscard?.();
    };

    const handleMount: DiffOnMount = (_editor, monaco) => {
        monacoRef.current = monaco;
        monaco.editor.defineTheme(MONACO_DARK_THEME,  INFERLOOP_MONO_THEME);
        monaco.editor.defineTheme(MONACO_LIGHT_THEME, INFERLOOP_MONO_THEME_LIGHT);
        monaco.editor.setTheme(activeTheme);
    };

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(modified);
            setCopied(true);
            notifySuccess('Copied improved code');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable in older browsers / insecure contexts */
        }
    };

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-[#18181b]">
            {/* Chrome bar — window dots, caption, view toggle + copy */}
            <div className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                    <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Diff · original → improved
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {/* View toggle: inline vs side-by-side */}
                    <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">
                        <button
                            type="button"
                            onClick={() => setRenderSideBySide(false)}
                            className={
                                renderSideBySide
                                    ? 'text-muted-foreground transition-colors hover:text-foreground'
                                    : 'text-foreground'
                            }
                        >
                            Inline
                        </button>
                        <span className="text-muted-foreground/40">/</span>
                        <button
                            type="button"
                            onClick={() => setRenderSideBySide(true)}
                            className={
                                renderSideBySide
                                    ? 'text-foreground'
                                    : 'text-muted-foreground transition-colors hover:text-foreground'
                            }
                        >
                            Split
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onCopy}
                        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* DiffEditor body */}
            <MonacoDiffEditor
                height={height}
                language={monacoLang}
                original={original}
                modified={modified}
                onMount={handleMount}
                theme={activeTheme}
                // Workaround for a known @monaco-editor/react disposal race:
                // by default the wrapper disposes the original+modified
                // TextModels on unmount, but the DiffEditorWidget is still
                // alive at that moment and crashes when its model emits a
                // dispose event ("TextModel got disposed before
                // DiffEditorWidget model got reset"). Keeping the models
                // alive lets Monaco's own lifecycle sequence widget-reset
                // → model-dispose in the safe order.
                keepCurrentOriginalModel
                keepCurrentModifiedModel
                loading={
                    <div className="flex h-full items-center justify-center">
                        <LoadingState label="Loading diff" />
                    </div>
                }
                options={{
                    readOnly: true,
                    renderSideBySide,
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                    fontSize: 12,
                    lineHeight: 0,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    renderIndicators: true,
                    renderLineHighlight: 'none',
                    lineNumbers: 'on',
                    folding: false,
                    glyphMargin: false,
                    scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                    },
                    // Smart diff — collapses unchanged regions when there are
                    // long stretches between edits. Keeps the diff scannable.
                    hideUnchangedRegions: {
                        enabled: true,
                        revealLineCount: 20,
                        minimumLineCount: 3,
                        contextLineCount: 3,
                    },
                }}
            />

            {/* Footer — Cursor-style Keep / Discard. Decision is reversible;
                clicking the other button after a decision flips state. */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-2.5">
                <DecisionStatus decision={decision} />
                <div className="flex items-center gap-2">
                    <DecisionButton
                        intent="discard"
                        active={decision === 'discarded'}
                        onClick={handleDiscard}
                    />
                    <DecisionButton
                        intent="keep"
                        active={decision === 'kept'}
                        onClick={handleKeep}
                    />
                </div>
            </div>
        </div>
    );
}

// ───────────────────────────── Footer pieces ───────────────────────────────

function DecisionStatus({ decision }: { decision: Decision }) {
    if (decision === 'pending') {
        return (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Apply this rewrite to your input?
            </p>
        );
    }
    if (decision === 'kept') {
        return (
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                <Check className="h-3 w-3" /> Kept · applied to input
            </p>
        );
    }
    return (
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-rose-300">
            <X className="h-3 w-3" /> Discarded · reverted to original
        </p>
    );
}

function DecisionButton({
    intent,
    active,
    onClick,
}: {
    intent: 'keep' | 'discard';
    active: boolean;
    onClick: () => void;
}) {
    const isKeep = intent === 'keep';
    const Icon   = isKeep ? Check : X;
    const label  = isKeep ? 'Keep' : 'Discard';

    // Active state = the user's current decision. Other button stays clickable
    // so the decision is reversible (Cursor does the same).
    const baseClass =
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors';
    const idleClass = isKeep
        ? 'border-border bg-transparent text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200'
        : 'border-border bg-transparent text-muted-foreground hover:border-rose-500/40   hover:bg-rose-500/10   hover:text-rose-200';
    const activeClass = isKeep
        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
        : 'border-rose-500/40   bg-rose-500/15   text-rose-200';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${baseClass} ${active ? activeClass : idleClass}`}
        >
            <Icon className="h-3 w-3" />
            {label}
        </button>
    );
}
