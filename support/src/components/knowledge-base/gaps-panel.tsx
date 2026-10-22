'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareText, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useClampPage } from '@/hooks/use-url-state';
import type { ListProps } from './list-props';
import { ago, EXAMPLE_MAX_CHARS } from '@/lib/knowledge-base';
import {
    useAnswerKnowledgeGapMutation,
    useDeleteKnowledgeGapMutation,
    useGetKnowledgeGapsQuery,
    type KnowledgeGap,
} from '@/store/api/knowledgeBaseApi';

const REASON: Record<KnowledgeGap['reason'], string> = {
    escalated: 'AI handed off to a human',
    low_confidence: 'No good match in the knowledge base',
};

// Real customer questions the AI struggled with, most-asked first. "Write reply" teaches the AI the exact
// answer to give next time; "Add to knowledge" turns it into a general knowledge entry instead.
export function GapsPanel({ onAnswer, q, page, limit, onPage, onLimit }: Pick<ListProps, 'q' | 'page' | 'limit' | 'onPage' | 'onLimit'> & { onAnswer: (question: string) => void }) {
    const { data, isLoading, isFetching } = useGetKnowledgeGapsQuery({ page, limit, q });
    const gaps = data?.items ?? [];
    const meta = data?.meta;
    useClampPage(page, meta?.totalPages, onPage);
    const [dismiss, { isLoading: dismissing }] = useDeleteKnowledgeGapMutation();
    const [answer, { isLoading: saving }] = useAnswerKnowledgeGapMutation();
    const [openId, setOpenId] = useState<string | null>(null);
    const [reply, setReply] = useState('');

    const save = async (id: string) => {
        try {
            await answer({ id, reply }).unwrap();
            toast.success('Saved — the AI will answer this way from now on');
            setOpenId(null);
            setReply('');
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Could not save the reply');
        }
    };

    if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
    if (gaps.length === 0) {
        return q ? (
            <div className="rounded-lg border bg-sidebar py-12 text-center text-sm text-muted-foreground">No unanswered questions match your search.</div>
        ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-sidebar py-12 text-center">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <p className="text-sm font-medium">Nothing unanswered</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                    When a customer asks something the AI can&apos;t answer from the knowledge base, it shows up here so you can tell it what to reply.
                </p>
            </div>
        );
    }
    return (
        <div className="space-y-3">
        <ul className="divide-y overflow-hidden rounded-lg border bg-sidebar">
            {gaps.map((g) => (
                <li key={g.id} className="space-y-3 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <p className="break-words text-sm">{g.question}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">{REASON[g.reason]}</Badge>
                                <span>Asked {g.count}×</span>
                                <span>last {ago(g.lastAskedAt)}</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                            <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => {
                                    setOpenId(openId === g.id ? null : g.id);
                                    setReply('');
                                }}
                            >
                                <MessageSquareText className="size-3.5" /> Write reply
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAnswer(g.question)}>
                                <Plus className="size-3.5" /> Add to knowledge
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
                    </div>
                    {openId === g.id && (
                        <div className="space-y-2 rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">
                                Write the reply exactly as you&apos;d want the AI to send it. Next time a customer asks this (or something close), it follows this reply.
                            </p>
                            <Textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                maxLength={EXAMPLE_MAX_CHARS}
                                rows={4}
                                placeholder="Write the reply…"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                                    Cancel
                                </Button>
                                <Button size="sm" disabled={saving || !reply.trim()} onClick={() => save(g.id)}>
                                    {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                                    Save reply
                                </Button>
                            </div>
                        </div>
                    )}
                </li>
            ))}
        </ul>
        {meta && (
            <PaginationBar page={meta.page} limit={meta.limit} total={meta.total} totalPages={meta.totalPages} onPageChange={onPage} onLimitChange={onLimit} isLoading={isFetching} />
        )}
        </div>
    );
}
