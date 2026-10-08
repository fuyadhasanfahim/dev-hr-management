'use client';

import { CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteKnowledgeGapMutation, useGetKnowledgeGapsQuery, type KnowledgeGap } from '@/store/api/knowledgeBaseApi';

const REASON: Record<KnowledgeGap['reason'], string> = {
    escalated: 'AI handed off to a human',
    low_confidence: 'No good match in the knowledge base',
};

function ago(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    if (min < 1440) return `${Math.floor(min / 60)}h ago`;
    return `${Math.floor(min / 1440)}d ago`;
}

// Real customer questions the AI struggled with, most-asked first. Answering one
// (Add answer) is how the AI gets better.
export function GapsPanel({ onAnswer }: { onAnswer: (question: string) => void }) {
    const { data: gaps = [], isLoading } = useGetKnowledgeGapsQuery();
    const [dismiss, { isLoading: dismissing }] = useDeleteKnowledgeGapMutation();

    if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
    if (gaps.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-sidebar py-12 text-center">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <p className="text-sm font-medium">Nothing unanswered</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                    When a customer asks something the AI can&apos;t answer from the knowledge base, it shows up here so you can add the answer.
                </p>
            </div>
        );
    }
    return (
        <ul className="divide-y overflow-hidden rounded-lg border bg-sidebar">
            {gaps.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0 space-y-1">
                        <p className="break-words text-sm">{g.question}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{REASON[g.reason]}</Badge>
                            <span>Asked {g.count}×</span>
                            <span>last {ago(g.lastAskedAt)}</span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button size="sm" className="gap-1.5" onClick={() => onAnswer(g.question)}>
                            <Plus className="size-3.5" /> Add answer
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            title="Dismiss"
                            disabled={dismissing}
                            onClick={() => dismiss(g.id)}
                        >
                            {dismissing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
