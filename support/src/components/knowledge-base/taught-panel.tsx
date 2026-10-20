'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ago, EXAMPLE_MAX_CHARS } from '@/lib/knowledge-base';
import {
    useCreateAiExampleMutation,
    useDeleteAiExampleMutation,
    useGetAiExamplesQuery,
    useUpdateAiExampleMutation,
    type AiExample,
} from '@/store/api/knowledgeBaseApi';

const errMsg = (err: unknown) => (err as { data?: { message?: string } })?.data?.message ?? 'Something went wrong';

function Editor({ initial, onDone }: { initial?: AiExample; onDone: () => void }) {
    const [question, setQuestion] = useState(initial?.question ?? '');
    const [reply, setReply] = useState(initial?.answer ?? '');
    const [create, { isLoading: creating }] = useCreateAiExampleMutation();
    const [update, { isLoading: updating }] = useUpdateAiExampleMutation();

    const save = async () => {
        try {
            if (initial) await update({ id: initial.id, question, reply }).unwrap();
            else await create({ question, reply }).unwrap();
            toast.success('Saved');
            onDone();
        } catch (err) {
            toast.error(errMsg(err));
        }
    };

    return (
        <div className="space-y-2 rounded-lg border bg-background p-3">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="When a customer says… (e.g. website banate koto khoroch?)" />
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={EXAMPLE_MAX_CHARS} rows={4} placeholder="…the AI should reply:" />
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
                <Button size="sm" disabled={creating || updating || !question.trim() || !reply.trim()} onClick={save}>
                    {(creating || updating) && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    Save
                </Button>
            </div>
        </div>
    );
}

// Replies staff wrote or corrected. The AI follows them whenever a customer says something similar.
export function TaughtPanel() {
    const { data: all = [], isLoading } = useGetAiExamplesQuery();
    const [remove, { isLoading: removing }] = useDeleteAiExampleMutation();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const taught = all.filter((e) => e.kind !== 'agent');

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-xs text-muted-foreground">
                    Question → reply pairs you taught the AI (from Unanswered questions, AI replies you corrected, or added here). They take priority over general
                    knowledge. If two disagree, the newest one wins.
                </p>
                <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
                    <Plus className="size-3.5" /> Teach a reply
                </Button>
            </div>
            {adding && <Editor onDone={() => setAdding(false)} />}
            {isLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
            ) : taught.length === 0 && !adding ? (
                <div className="rounded-lg border bg-sidebar py-12 text-center text-sm text-muted-foreground">Nothing taught yet.</div>
            ) : (
                <ul className="divide-y overflow-hidden rounded-lg border bg-sidebar">
                    {taught.map((e) =>
                        editingId === e.id ? (
                            <li key={e.id} className="p-3">
                                <Editor initial={e} onDone={() => setEditingId(null)} />
                            </li>
                        ) : (
                            <li key={e.id} className="flex items-start justify-between gap-3 p-3">
                                <div className="min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="outline">{e.kind === 'correction' ? 'Correction' : 'Taught reply'}</Badge>
                                        <span>
                                            {e.createdByName ?? 'Staff'} · {ago(e.createdAt)}
                                        </span>
                                    </div>
                                    <p className="break-words text-sm font-medium">{e.question}</p>
                                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{e.answer}</p>
                                </div>
                                <div className="flex shrink-0 items-center">
                                    <Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditingId(e.id)}>
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive"
                                        aria-label="Delete"
                                        disabled={removing}
                                        onClick={() => remove(e.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        ),
                    )}
                </ul>
            )}
        </div>
    );
}
