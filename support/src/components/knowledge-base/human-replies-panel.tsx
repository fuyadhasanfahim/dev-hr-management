'use client';

import { useState } from 'react';
import { Check, GraduationCap, Loader2, Sparkles, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useClampPage } from '@/hooks/use-url-state';
import type { ListProps } from './list-props';
import { ago, KB_INSTRUCTIONS_CATEGORY, KB_MAX_CHARS } from '@/lib/knowledge-base';
import {
    useCreateKnowledgeChunkMutation,
    useDeleteAiExampleMutation,
    useDraftStyleGuideMutation,
    useGetAiExamplesQuery,
    useUpdateAiExampleMutation,
} from '@/store/api/knowledgeBaseApi';

const errMsg = (err: unknown) => (err as { data?: { message?: string } })?.data?.message ?? 'Something went wrong';

// Replies our human agents sent, each next to the customer message it answered. Approve the good ones ("Teach AI")
// and the AI copies how the team talks; the style guide distils the pattern into a rule.
export function HumanRepliesPanel({ q, page, limit, view: viewParam, onPage, onLimit, onView }: ListProps) {
    const view: 'new' | 'taught' = viewParam === 'taught' ? 'taught' : 'new';
    const { data, isLoading, isFetching } = useGetAiExamplesQuery({ kind: 'agent', approved: view === 'taught', page, limit, q });
    const rows = data?.items ?? [];
    const meta = data?.meta;
    useClampPage(page, meta?.totalPages, onPage);
    const [update, { isLoading: updating }] = useUpdateAiExampleMutation();
    const [remove, { isLoading: removing }] = useDeleteAiExampleMutation();
    const [draft, { isLoading: drafting }] = useDraftStyleGuideMutation();
    const [saveRule, { isLoading: savingRule }] = useCreateKnowledgeChunkMutation();
    const [guide, setGuide] = useState<string | null>(null);

    const makeGuide = async () => {
        try {
            setGuide((await draft().unwrap()).text);
        } catch (err) {
            toast.error(errMsg(err));
        }
    };
    const saveGuide = async () => {
        try {
            await saveRule({ text: `How our team talks: ${guide}`.slice(0, KB_MAX_CHARS), source: KB_INSTRUCTIONS_CATEGORY }).unwrap();
            toast.success('Saved as an AI instruction');
            setGuide(null);
        } catch (err) {
            toast.error(errMsg(err));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-xs text-muted-foreground">
                    Replies your team sent to customers on WhatsApp. Tap <b>Teach AI</b> on the ones that are exactly how you want the AI to greet, open and
                    continue a conversation. Only the ones you approve are used.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={view} onValueChange={(v) => onView(v === 'new' ? '' : v)}>
                        <TabsList>
                            <TabsTrigger value="new">To review</TabsTrigger>
                            <TabsTrigger value="taught">Taught</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={drafting} onClick={makeGuide}>
                        {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                        Draft style guide
                    </Button>
                </div>
            </div>

            {guide !== null && (
                <div className="space-y-2 rounded-lg border bg-sidebar p-3">
                    <p className="text-xs text-muted-foreground">
                        The AI studied your team&apos;s replies. Edit it if needed, then save it as an AI instruction (counts toward the {KB_MAX_CHARS}-character limit).
                    </p>
                    <Textarea value={guide} onChange={(e) => setGuide(e.target.value)} maxLength={KB_MAX_CHARS - 24} rows={7} />
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setGuide(null)}>
                            Discard
                        </Button>
                        <Button size="sm" disabled={savingRule || !guide.trim()} onClick={saveGuide}>
                            {savingRule && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                            Save as AI instruction
                        </Button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
            ) : rows.length === 0 ? (
                <div className="rounded-lg border bg-sidebar py-12 text-center text-sm text-muted-foreground">
                    {q ? 'No human replies match your search.' : view === 'new' ? 'No new human replies to review. They appear here as your team answers customers.' : 'Nothing taught yet.'}
                </div>
            ) : (
                <ul className="divide-y overflow-hidden rounded-lg border bg-sidebar">
                    {rows.map((e) => (
                        <li key={e.id} className="space-y-2 p-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <User className="size-3.5" />
                                <span className="font-medium text-foreground">{e.agentName ?? 'Agent'}</span>
                                <span>{ago(e.createdAt)}</span>
                                {e.approved && (
                                    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                        <Check className="size-3" /> Taught
                                    </Badge>
                                )}
                            </div>
                            {e.context && <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{e.context}</p>}
                            <p className="rounded-lg bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">{e.question}</p>
                            <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm break-words whitespace-pre-wrap">{e.answer}</p>
                            <div className="flex gap-2">
                                {e.approved ? (
                                    <Button size="sm" variant="outline" disabled={updating} onClick={() => update({ id: e.id, approved: false })}>
                                        Stop using
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="gap-1.5"
                                        disabled={updating}
                                        onClick={() => update({ id: e.id, approved: true }).unwrap().catch((err) => toast.error(errMsg(err)))}
                                    >
                                        <GraduationCap className="size-3.5" /> Teach AI
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" disabled={removing} onClick={() => remove(e.id)}>
                                    <Trash2 className="size-3.5" /> Remove
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {meta && meta.total > 0 && (
                <PaginationBar page={meta.page} limit={meta.limit} total={meta.total} totalPages={meta.totalPages} onPageChange={onPage} onLimitChange={onLimit} isLoading={isFetching} />
            )}
        </div>
    );
}
