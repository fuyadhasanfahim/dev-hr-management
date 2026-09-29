'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// next-themes injects an inline <script> to set the theme class before
// hydration (avoids a flash of the wrong theme). It works correctly — SSR and
// the client agree — but React 19 warns on any <script> rendered as a React
// element, and next-themes hasn't shipped a fix (dormant upstream). Silence
// just that one known-safe message so it doesn't trip Next's dev error
// overlay; everything else still reaches the console.
if (process.env.NODE_ENV === 'development') {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) return;
        originalError(...args);
    };
}

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
