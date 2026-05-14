'use client';

// Theme state lives in localStorage and is mirrored to the `dark` class on
// <html>. The FOUC-prevention script in app/layout.tsx reads the same key
// pre-paint, so the initial render matches the stored preference. This
// provider then takes over for subsequent toggles.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'inferloop.theme';

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
    setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyToDOM(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // SSR-safe initial: assume dark to match the layout's pre-paint default.
    // The effect below corrects it to whatever's actually in localStorage.
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
        setThemeState(stored);
        applyToDOM(stored);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        localStorage.setItem(STORAGE_KEY, next);
        applyToDOM(next);
    }, []);

    const toggle = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    return (
        <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
    return ctx;
}
