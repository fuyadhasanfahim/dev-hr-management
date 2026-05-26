import { create } from 'zustand';

interface AuthState {
    isLoading: boolean;
    error: string | null;
    email: string;
    callbackUrl: string;
    setLoading: (v: boolean) => void;
    setError: (v: string | null) => void;
    setEmail: (v: string) => void;
    setCallbackUrl: (v: string) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoading: false,
    error: null,
    email: '',
    callbackUrl: '',
    setLoading: (v) => set({ isLoading: v }),
    setError: (v) => set({ error: v }),
    setEmail: (v) => set({ email: v }),
    setCallbackUrl: (v) => set({ callbackUrl: v }),
    clearError: () => set({ error: null }),
}));
