'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'support-notification-sound';

export function useNotificationSound() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [enabled, setEnabled] = useState(true);
    const isPageVisible = useRef(true);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) setEnabled(stored === 'true');

        audioRef.current = new Audio('/sounds/notification.wav');
        audioRef.current.volume = 0.5;

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
        setEnabled((prev) => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    return { playSound, enabled, toggleSound, isPageVisible };
}
