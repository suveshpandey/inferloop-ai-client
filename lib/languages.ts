// Single source of truth for languages the app supports.
//
// Adding a new language is a one-file change: append an entry below. Every
// consumer (review page selector, default state, Monaco syntax highlighting,
// editor placeholders, and — in Phase 2 — the sandbox runner dispatcher)
// reads from here.
//
// `sandboxReady` gates the future "Run tests" button. New languages can land
// in the UI with `sandboxReady: false` while their container image is still
// being built; the agent pipeline works on them, but execution stays hidden
// until the runner exists.

export type SupportedLanguage = {
    /** Wire value sent to the backend and stored on the Run row. Lowercase. */
    value: string;
    /** Human-readable label shown in the selector. */
    label: string;
    /** Monaco's own language id for syntax highlighting. Usually equals
     *  `value`, but kept separate so the wire value stays stable even if
     *  Monaco renames an id. */
    monaco: string;
    /** Editor placeholder text. Should look like real code in this language
     *  so it reads as a hint, not a label. */
    placeholder: string;
    /** Whether the Phase 2 sandbox runner exists for this language. Until it
     *  does, the test-execution UI is hidden. */
    sandboxReady: boolean;
};

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
    {
        value:        'python',
        label:        'Python',
        monaco:       'python',
        placeholder:  '# paste your Python solution here',
        sandboxReady: true,
    },
    {
        value:        'cpp',
        label:        'C++',
        monaco:       'cpp',
        placeholder:  '// paste your C++ solution here',
        sandboxReady: true,
    },
];

/** Default language the review page selects when the user hasn't picked one. */
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0].value;

/** Lookup the full record by value. Returns undefined for unknown languages
 *  (e.g., legacy runs from before a language was renamed/removed). */
export function getLanguage(value: string): SupportedLanguage | undefined {
    return SUPPORTED_LANGUAGES.find((l) => l.value === value);
}

/** Map an InferLoop language value to Monaco's syntax-highlighting language
 *  id. Falls back to 'plaintext' so a legacy/unknown value still renders
 *  without throwing. */
export function toMonacoLanguage(value: string): string {
    return getLanguage(value)?.monaco ?? 'plaintext';
}

/** Per-language placeholder shown inside the Monaco editor. Falls back to a
 *  generic hint for unknown languages. */
export function placeholderFor(value: string): string {
    return getLanguage(value)?.placeholder ?? '// paste your code here';
}
