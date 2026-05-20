// Wires Monaco's `MonacoEnvironment.getWorker` for browser bundlers that
// don't have a Monaco plugin (Turbopack, Vite, modern Webpack with
// `new URL(...)` worker support). Without this, Monaco falls back to running
// language services on the main thread — which freezes the UI and blocks
// client-side router navigation.
//
// `new URL(..., import.meta.url)` is the form Turbopack statically analyzes
// to emit a separate worker chunk, so each worker comes back as its own
// network request and runs in a real Web Worker.

let wired = false;

export function setupMonacoWorkers() {
    if (wired || typeof window === 'undefined') return;
    wired = true;

    (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker(_id: string, label: string) {
            if (label === 'typescript' || label === 'javascript') {
                return new Worker(
                    new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
                    { type: 'module' },
                );
            }
            if (label === 'json') {
                return new Worker(
                    new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
                    { type: 'module' },
                );
            }
            if (label === 'css' || label === 'scss' || label === 'less') {
                return new Worker(
                    new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
                    { type: 'module' },
                );
            }
            if (label === 'html' || label === 'handlebars' || label === 'razor') {
                return new Worker(
                    new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
                    { type: 'module' },
                );
            }
            return new Worker(
                new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
                { type: 'module' },
            );
        },
    };
}
