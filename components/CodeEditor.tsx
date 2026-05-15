'use client';

// Thin Monaco wrapper for the review form's code input. Loads dynamically
// (Monaco is ~600KB and browser-only — never import on the server). Renders
// in a custom "inferloop-mono" theme — dark zinc background to match the
// app's palette, with desaturated pastel accents so syntax is still
// distinguishable without shouting color.

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount, EditorProps } from '@monaco-editor/react';
import { LoadingState } from '@/components/ui/spinner';
import { useTheme } from '@/contexts/ThemeContext';
import {
    INFERLOOP_MONO_THEME,
    INFERLOOP_MONO_THEME_LIGHT,
    LANGUAGE_TO_MONACO,
    MONACO_DARK_THEME,
    MONACO_LIGHT_THEME,
} from '@/lib/monaco-theme';

// Dynamic import keeps Monaco out of the server bundle and lets us order the
// setup deterministically: load monaco → load @monaco-editor/react → point
// its loader at our local monaco instance → return the Editor component. By
// the time the editor mounts and calls `loader.init()`, the config is set,
// so it never tries to fetch the AMD loader.js from jsdelivr at runtime.
//
// `import('monaco-editor')` hits the package's `"import"` export condition,
// which resolves to `esm/vs/editor/editor.main.js` — the bundler-friendly
// ESM build. (The legacy `"require"` condition points at the AMD bundle in
// `min/vs/...`, which uses syntax like `vs/nls.messages-loader!` that
// bundlers cannot parse — don't reach for `require` here.)
const MonacoEditor = dynamic(
    async () => {
        const monaco = await import('monaco-editor');
        const reactMonaco = await import('@monaco-editor/react');
        reactMonaco.loader.config({ monaco });
        return reactMonaco.Editor;
    },
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full items-center justify-center">
                <LoadingState label="Loading editor" />
            </div>
        ),
    },
);

type Props = {
    value: string;
    onChange: (next: string) => void;
    language: string;
    readOnly?: boolean;
    /** Pixel height for the editor surface. */
    height?: number | string;
    placeholder?: string;
};

export function CodeEditor({
    value,
    onChange,
    language,
    readOnly = false,
    height = 320,
    placeholder,
}: Props) {
    const monacoLang = LANGUAGE_TO_MONACO[language] ?? 'plaintext';
    const { theme } = useTheme();
    const activeTheme = theme === 'light' ? MONACO_LIGHT_THEME : MONACO_DARK_THEME;

    // Hold a ref to Monaco's namespace from onMount so we can flip the theme
    // when the app theme changes without remounting the editor.
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

    useEffect(() => {
        monacoRef.current?.editor.setTheme(activeTheme);
    }, [activeTheme]);

    // Monaco only applies onMount once per editor instance, so there's no
    // perf cost to defining this here.
    const handleMount: OnMount = (editor, monaco) => {
        monacoRef.current = monaco;
        // Register both themes once on mount. `setTheme` is global so it
        // persists across editor instances; we call it explicitly so HMR
        // replays don't leave us on a stale theme.
        monaco.editor.defineTheme(MONACO_DARK_THEME,  INFERLOOP_MONO_THEME);
        monaco.editor.defineTheme(MONACO_LIGHT_THEME, INFERLOOP_MONO_THEME_LIGHT);
        monaco.editor.setTheme(activeTheme);

        // Monaco has no native placeholder. We attach a content widget that
        // floats over (1, 1) and removes itself the first time the buffer
        // becomes non-empty. Lifetime is tied to the editor instance, so
        // disposal is handled when Monaco tears down.
        if (placeholder && !editor.getValue()) {
            const node = document.createElement('div');
            node.textContent      = placeholder;
            // Pick a muted color matching the active theme. Pulled from CSS
            // so the placeholder follows light/dark mode like everything else.
            node.style.color      = theme === 'light' ? '#a1a1aa' : '#5a5a5a';
            node.style.fontStyle  = 'italic';
            node.style.pointerEvents = 'none';
            node.style.whiteSpace = 'pre';

            const widget = {
                getId:       () => 'inferloop.placeholder',
                getDomNode:  () => node,
                getPosition: () => ({
                    position: { lineNumber: 1, column: 1 },
                    preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
                }),
            };
            editor.addContentWidget(widget);

            const sub = editor.onDidChangeModelContent(() => {
                if (editor.getValue().length > 0) {
                    editor.removeContentWidget(widget);
                    sub.dispose();
                }
            });
        }
    };

    return (
        <MonacoEditor
            height={height}
            language={monacoLang}
            value={value}
            onChange={(v) => onChange(v ?? '')}
            onMount={handleMount}
            theme={activeTheme}
            // Replaces Monaco's default "Loading..." text shown while the
            // editor's runtime initializes (after the JS chunk lands but
            // before Monaco itself is ready). The dynamic() loading state
            // above covers the earlier "JS chunk downloading" phase.
            loading={
                <div className="flex h-full items-center justify-center">
                    <LoadingState label="Loading editor" />
                </div>
            }
            options={{
                ...VS_CODE_DEFAULT_OPTIONS,
                readOnly,
                automaticLayout: true,
            }}
        />
    );
}

// Editor options matching the default VS Code Monaco configuration. Most of
// these are Monaco's own defaults, but pinning them explicitly here makes the
// "looks like VS Code" expectation a contract rather than something that could
// silently drift if Monaco changes its defaults in a future minor release.
const VS_CODE_DEFAULT_OPTIONS: NonNullable<EditorProps['options']> = {
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    accessibilitySupport: 'auto',
    accessibilityPageSize: 10,
    ariaLabel: 'Editor content',
    ariaRequired: false,
    screenReaderAnnounceInlineSuggestion: true,
    autoClosingBrackets: 'languageDefined',
    autoClosingComments: 'languageDefined',
    autoClosingDelete: 'auto',
    autoClosingOvertype: 'auto',
    autoClosingQuotes: 'languageDefined',
    autoIndent: 'full',
    autoSurround: 'languageDefined',
    bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: false,
    },
    guides: {
        bracketPairs: false,
        bracketPairsHorizontal: 'active',
        highlightActiveBracketPair: true,
        indentation: true,
        highlightActiveIndentation: true,
    },
    stickyTabStops: false,
    codeLens: true,
    codeLensFontFamily: '',
    codeLensFontSize: 0,
    colorDecorators: true,
    colorDecoratorsActivatedOn: 'clickAndHover',
    colorDecoratorsLimit: 500,
    columnSelection: false,
    comments: {
        insertSpace: true,
        ignoreEmptyLines: true,
    },
    contextmenu: true,
    copyWithSyntaxHighlighting: true,
    cursorBlinking: 'blink',
    cursorSmoothCaretAnimation: 'off',
    cursorStyle: 'line',
    cursorSurroundingLines: 0,
    cursorSurroundingLinesStyle: 'default',
    cursorWidth: 0,
    disableLayerHinting: false,
    disableMonospaceOptimizations: false,
    domReadOnly: false,
    dragAndDrop: true,
    emptySelectionClipboard: true,
    dropIntoEditor: {
        enabled: true,
        showDropSelector: 'afterDrop',
    },
    stickyScroll: {
        enabled: true,
        maxLineCount: 5,
        defaultModel: 'outlineModel',
        scrollWithEditor: true,
    },
    experimentalWhitespaceRendering: 'svg',
    extraEditorClassName: '',
    fastScrollSensitivity: 5,
    find: {
        cursorMoveOnType: true,
        seedSearchStringFromSelection: 'always',
        autoFindInSelection: 'never',
        addExtraSpaceOnTop: true,
        loop: true,
    },
    fixedOverflowWidgets: false,
    folding: true,
    foldingStrategy: 'auto',
    foldingHighlight: true,
    foldingImportsByDefault: false,
    foldingMaximumRegions: 5000,
    unfoldOnClickAfterEndOfLine: false,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontLigatures: false,
    fontSize: 12,
    fontWeight: 'normal',
    fontVariations: false,
    formatOnPaste: false,
    formatOnType: false,
    glyphMargin: true,
    gotoLocation: {
        multipleDefinitions: 'peek',
        multipleTypeDefinitions: 'peek',
        multipleDeclarations: 'peek',
        multipleImplementations: 'peek',
        multipleReferences: 'peek',
        alternativeDefinitionCommand: 'editor.action.goToReferences',
        alternativeTypeDefinitionCommand: 'editor.action.goToReferences',
        alternativeDeclarationCommand: 'editor.action.goToReferences',
        alternativeImplementationCommand: '',
        alternativeReferenceCommand: '',
    },
    hideCursorInOverviewRuler: false,
    hover: {
        enabled: true,
        delay: 300,
        sticky: true,
        hidingDelay: 300,
        above: true,
    },
    letterSpacing: 0,
    lightbulb: { enabled: 'on' as never },
    lineDecorationsWidth: 10,
    lineHeight: 0,
    lineNumbers: 'on',
    lineNumbersMinChars: 5,
    linkedEditing: false,
    links: true,
    matchBrackets: 'always',
    minimap: {
        enabled: true,
        size: 'proportional',
        side: 'right',
        showSlider: 'mouseover',
        scale: 1,
        renderCharacters: true,
        maxColumn: 120,
        showRegionSectionHeaders: true,
        showMarkSectionHeaders: true,
        sectionHeaderFontSize: 9,
        sectionHeaderLetterSpacing: 1,
    },
    mouseStyle: 'text',
    mouseWheelScrollSensitivity: 1,
    mouseWheelZoom: false,
    multiCursorMergeOverlapping: true,
    multiCursorModifier: 'alt',
    multiCursorPaste: 'spread',
    multiCursorLimit: 10000,
    occurrencesHighlight: 'singleFile',
    overviewRulerBorder: true,
    overviewRulerLanes: 2,
    padding: { top: 0, bottom: 0 },
    pasteAs: {
        enabled: true,
        showPasteSelector: 'afterPaste',
    },
    parameterHints: { enabled: true, cycle: true },
    peekWidgetDefaultFocus: 'tree',
    definitionLinkOpensInPeek: false,
    quickSuggestions: {
        other: 'on',
        comments: 'off',
        strings: 'off',
    },
    quickSuggestionsDelay: 10,
    renameOnType: false,
    renderControlCharacters: true,
    renderFinalNewline: 'on',
    renderLineHighlight: 'line',
    renderLineHighlightOnlyWhenFocus: false,
    renderValidationDecorations: 'editable',
    renderWhitespace: 'selection',
    revealHorizontalRightPadding: 15,
    roundedSelection: true,
    rulers: [],
    scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 12,
        scrollByPage: false,
        ignoreHorizontalScrollbarInContentHeight: false,
    },
    scrollBeyondLastColumn: 4,
    scrollBeyondLastLine: true,
    scrollPredominantAxis: true,
    selectionClipboard: true,
    selectionHighlight: true,
    selectOnLineNumbers: true,
    showFoldingControls: 'mouseover',
    showUnused: true,
    showDeprecated: true,
    inlayHints: {
        enabled: 'on',
        fontSize: 0,
        fontFamily: '',
        padding: false,
    },
    snippetSuggestions: 'inline',
    smartSelect: {
        selectLeadingAndTrailingWhitespace: true,
        selectSubwords: true,
    },
    smoothScrolling: false,
    stopRenderingLineAfter: 10000,
    suggest: {
        insertMode: 'insert',
        filterGraceful: true,
        localityBonus: false,
        shareSuggestSelections: false,
        selectionMode: 'always',
        snippetsPreventQuickSuggestions: false,
        showIcons: true,
        showStatusBar: false,
        preview: false,
        showInlineDetails: true,
        matchOnWordStartOnly: true,
    },
    inlineSuggest: {
        enabled: true,
        showToolbar: 'onHover',
        suppressSuggestions: false,
        fontFamily: 'default',
    },
    inlineCompletionsAccessibilityVerbose: false,
    suggestFontSize: 0,
    suggestLineHeight: 0,
    suggestOnTriggerCharacters: true,
    suggestSelection: 'first',
    tabCompletion: 'off',
    tabIndex: 0,
    unicodeHighlight: {
        nonBasicASCII: 'inUntrustedWorkspace',
        invisibleCharacters: true,
        ambiguousCharacters: true,
        includeComments: 'inUntrustedWorkspace',
        includeStrings: true,
    },
    unusualLineTerminators: 'prompt',
    useTabStops: true,
    wordBreak: 'normal',
    wordSegmenterLocales: [],
    wordSeparators: "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?",
    wordWrap: 'off',
    wordWrapColumn: 80,
    wordWrapOverride1: 'inherit',
    wordWrapOverride2: 'inherit',
    wrappingIndent: 'same',
    wrappingStrategy: 'simple',
};

