'use client';

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import { api, tokens } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

type AuthState =
    | { status: 'loading'; user: null }
    | { status: 'authenticated'; user: MeResponse }
    | { status: 'unauthenticated'; user: null };

type AuthContextValue = AuthState & {
    login:  (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, username?: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

    // On mount: if we have tokens in localStorage, try to load the user.
    useEffect(() => {
        let cancelled = false;

        async function hydrate() {
            if (!tokens.getAccess() && !tokens.getRefresh()) {
                if (!cancelled) setState({ status: 'unauthenticated', user: null });
                return;
            }
            try {
                const user = await api.me();   // auto-refreshes on 401
                if (!cancelled) setState({ status: 'authenticated', user });
            } catch {
                tokens.clear();
                if (!cancelled) setState({ status: 'unauthenticated', user: null });
            }
        }

        hydrate();
        return () => { cancelled = true; };
    }, []);

    const login = async (email: string, password: string) => {
        await api.login({ email, password });
        const user = await api.me();
        setState({ status: 'authenticated', user });
    };

    const signup = async (email: string, password: string, username?: string) => {
        await api.signup({ email, password, username });
        const user = await api.me();
        setState({ status: 'authenticated', user });
    };

    const logout = async () => {
        await api.logout();
        setState({ status: 'unauthenticated', user: null });
    };

    return (
        <AuthContext.Provider value={{ ...state, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
