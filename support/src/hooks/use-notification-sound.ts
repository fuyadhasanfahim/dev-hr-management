'use client';

import { useRef, useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'support-notification-sound';
const CHANGED = 'support-notification-sound-changed';

// The on/off switch lives in localStorage so it survives reloads and is shared by every component using the hook.
function subscribe(onChange: () => void) {
    window.addEventListener(CHANGED, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(CHANGED, onChange);
        window.removeEventListener('storage', onChange);
    };
}
const readEnabled = () => localStorage.getItem(STORAGE_KEY) !== 'false';

export function useNotificationSound() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
    const isPageVisible = useRef(true);

    useEffect(() => {
        audioRef.current = new Audio('/sounds/message.wav');
        audioRef.current.volume = 1;

        const onVisibility = () => {
            isPageVisible.current = document.visibilityState === 'visible';
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const playSound = useCallback(() => {
        if (!enabled || !audioRef.current) return;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
    }, [enabled]);

    const toggleSound = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, String(!readEnabled()));
        window.dispatchEvent(new Event(CHANGED));
    }, []);

    return { playSound, enabled, toggleSound, isPageVisible };
}
