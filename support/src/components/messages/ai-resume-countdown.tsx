'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Blinking red info icon + live countdown shown while AI is paused after an
// agent reply. Hover explains that AI will switch itself back on.
export function AiResumeCountdown({ resumeAt }: { resumeAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const left = Math.max(0, Math.ceil((new Date(resumeAt).getTime() - now) / 1000));
    const label = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

    return (
        <span className="flex items-center gap-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" aria-label="AI auto-reply resume info" className="animate-pulse text-red-500">
                        <Info className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    No agent is active in this chat. AI auto-reply will turn back on automatically in {Math.floor(left / 60)} min{' '}
                    {left % 60} sec.
                </TooltipContent>
            </Tooltip>
            <span className="font-mono text-xs tabular-nums text-red-500">{label}</span>
        </span>
    );
}
