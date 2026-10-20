'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, ChevronDown, Loader2, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ago, EXAMPLE_MAX_CHARS } from '@/lib/knowledge-base';
import { useCorrectAiReplyMutation, useGetAiRepliesQuery, type AiReply } from '@/store/api/knowledgeBaseApi';

function ReplyCard({ r }: { r: AiReply }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(r.aiReply);
    const [showMore, setShowMore] = useState(false);
    const [correct, { isLoading }] = useCorrectAiReplyMutation();

    const save = async () => {
        try {
            await correct({ id: r.id, reply: text }).unwrap();
            toast.success('Saved — the AI will reply like this next time');
            setEditing(false);
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Could not save the correction');
        }
    };

    return (
        <li className="space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.customerName || 'Customer'}</span>
                <span>{ago(r.createdAt)}</span>
                {r.escalated && <Badge variant="outline">Handed off</Badge>}
                {r.status === 'corrected' && (
                    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Corrected
                    </Badge>
                )}
                {r.topScore != null && r.topScore < 0.35 && <Badge variant="outline">Weak knowledge match</Badge>}
            </div>
            <div className="space-y-2">
                <p className="rounded-lg bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">{r.customerMessage}</p>
                <div className="flex items-start gap-2">
                    <Bot className="mt-2 size-4 shrink-0 text-primary" />
                    <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm break-words whitespace-pre-wrap">{r.aiReply}</p>
                </div>
            </div>

            {editing ? (
                <div className="space-y-2 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Rewrite the reply the way it should have been sent.</p>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={EXAMPLE_MAX_CHARS} rows={5} autoFocus />
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" disabled={isLoading || !text.trim() || text.trim() === r.aiReply.trim()} onClick={save}>
                            {isLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                            Save correction
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                        <PencilLine className="size-3.5" /> {r.status === 'corrected' ? 'Correct again' : 'Correct this reply'}
                    </Button>
                    {(r.context || r.sources.length > 0) && (
                        <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setShowMore((v) => !v)}>
                            What the AI saw <ChevronDown className={`size-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                        </Button>
                    )}
                </div>
            )}

            {showMore && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    {r.context && (
                        <div>
                            <p className="mb-1 font-medium text-foreground">Chat before this message</p>
                            <p className="whitespace-pre-wrap break-words">{r.context}</p>
                        </div>
                    )}
                    {r.sources.length > 0 && (
                        <div>
                            <p className="mb-1 font-medium text-foreground">Knowledge it read</p>
                            <ul className="list-disc space-y-0.5 pl-4">
                                {r.sources.map((s, i) => (
                                    <li key={i} className="break-words">
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

// Every reply the AI sent on WhatsApp, newest first. Correcting one teaches the AI the better reply.
export function RepliesPanel() {
    const [status, setStatus] = useState<'all' | 'ok' | 'corrected'>('all');
    const { data: replies = [], isLoading } = useGetAiRepliesQuery(status === 'all' ? undefined : { status });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-xs text-muted-foreground">
                    Everything the AI replied to customers. If a reply was wrong or not how you&apos;d say it, correct it — the AI uses your version the next time
                    a similar message comes in, and the newest correction wins.
                </p>
                <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="ok">Not reviewed</TabsTrigger>
                        <TabsTrigger value="corrected">Corrected</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
            ) : replies.length === 0 ? (
                <div className="rounded-lg border bg-sidebar py-12 text-center text-sm text-muted-foreground">No AI replies here yet.</div>
            ) : (
                <ul className="divide-y overflow-hidden rounded-lg border bg-sidebar">
                    {replies.map((r) => (
                        <ReplyCard key={r.id} r={r} />
                    ))}
                </ul>
            )}
        </div>
    );
}
