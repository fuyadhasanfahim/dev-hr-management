'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

/**
 * Typing is instant; `onSearch` fires 400ms after the last keystroke, only when the text differs from `value`
 * (the value in the URL). Give it a `key` that changes with the view so each view starts from its own ?q=.
 */
export function SearchInput({ value, placeholder, onSearch }: { value: string; placeholder: string; onSearch: (q: string) => void }) {
    const [text, setText] = useState(value);
    const debounced = useDebounce(text, 400).trim();
    useEffect(() => {
        if (debounced !== value) onSearch(debounced);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);
    return (
        <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Search" className="h-9 pl-8" />
        </div>
    );
}
