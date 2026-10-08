'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isInstructions } from '@/lib/knowledge-base';
import { useTestKnowledgeBaseMutation } from '@/store/api/knowledgeBaseApi';

// Ask the AI a customer question and see exactly which entries it read.
export function TestPanel() {
    const [question, setQuestion] = useState('');
    const [run, { data, isLoading, error, reset }] = useTestKnowledgeBaseMutation();

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (question.trim()) run(question.trim());
    };

    return (
        <div className="space-y-4">
            <form onSubmit={submit} className="flex max-w-2xl gap-2">
                <Input
                    value={question}
                    onChange={(e) => {
                        setQuestion(e.target.value);
                        if (data || error) reset();
                    }}
                    maxLength={500}
                    placeholder="Type a customer question, e.g. website banate koto khoroch?"
                />
                <Button type="submit" disabled={isLoading || !question.trim()} className="gap-2 shrink-0">
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Ask the AI
                </Button>
            </form>
            <p className="max-w-2xl text-xs text-muted-foreground">
                This runs the real AI as if a customer wrote it. Nothing is sent or saved, and it won&apos;t appear in
                &quot;Unanswered questions&quot;.
            </p>

            {error && <p className="text-sm text-destructive">Could not get an answer — try again.</p>}

            {data && (
                <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-lg border bg-sidebar p-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium">AI reply</h3>
                            {data.escalate && <Badge variant="destructive">Would hand off to a human</Badge>}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{data.reply}</p>
                        {data.escalate && data.escalateReason && (
                            <p className="text-xs text-muted-foreground">Reason: {data.escalateReason}</p>
                        )}
                        {data.lowConfidence && (
                            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                Nothing in the knowledge base matched well (best match under {Math.round(data.lowConfidenceBelow * 100)}%).
                                Add an entry that answers this and ask again.
                            </p>
                        )}
                    </div>

                    <div className="space-y-3 rounded-lg border bg-sidebar p-4">
                        <h3 className="text-sm font-medium">Entries the AI read ({data.matches.length})</h3>
                        {data.matches.length === 0 ? (
                            <p className="text-sm text-muted-foreground">None. The AI answered with no business knowledge.</p>
                        ) : (
                            <ul className="space-y-2">
                                {data.matches.map((m) => (
                                    <li key={m.id} className="rounded-md border bg-background p-2.5">
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            {m.source ? (
                                                <Badge variant="outline">{isInstructions(m.source) ? 'Rule' : m.source}</Badge>
                                            ) : (
                                                <span />
                                            )}
                                            <span
                                                className={cn(
                                                    'text-xs font-medium tabular-nums',
                                                    m.score >= data.lowConfidenceBelow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                                                )}
                                            >
                                                {Math.round(m.score * 100)}% match
                                            </span>
                                        </div>
                                        <p className="line-clamp-3 text-xs text-muted-foreground">{m.text}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
