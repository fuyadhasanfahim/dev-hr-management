import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// WhatsApp's Cloud API never exposes a customer's profile photo, so each
// customer gets initials on a colour picked from their name/phone — stable
// across sessions, like Gmail/Slack fallbacks.
const TONES = [
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-fuchsia-500',
];

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    // A bare phone number reads better as its last two digits than as "+8".
    if (/^\+?[\d\s-]+$/.test(name)) return name.replace(/\D/g, '').slice(-2);
    return (words[0]![0]! + (words.length > 1 ? words[words.length - 1]![0]! : '')).toUpperCase();
}

function tone(seed: string): string {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TONES[h % TONES.length]!;
}

export function CustomerAvatar({ name, seed, className }: { name: string; seed?: string; className?: string }) {
    return (
        <Avatar className={className}>
            <AvatarFallback className={cn('font-medium text-white', tone(seed ?? name))}>{initials(name)}</AvatarFallback>
        </Avatar>
    );
}
