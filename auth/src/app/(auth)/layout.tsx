import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div
            className="min-h-svh flex items-center justify-center p-4 bg-background"
            style={{
                backgroundImage:
                    'radial-gradient(ellipse 80% 40% at 50% 0%, color-mix(in oklch, var(--primary) 10%, transparent) 0%, transparent 100%)',
            }}
        >
            {children}
        </div>
    );
}
