'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { apiMessage } from '@/lib/api-error';
import {
    BookOpen,
    Eye,
    Loader2,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { readPaging, useClampPage, useUrlState } from '@/hooks/use-url-state';
import { SearchInput } from '@/components/ui/search-input';
import { RepliesPanel } from '@/components/knowledge-base/replies-panel';
import { TaughtPanel } from '@/components/knowledge-base/taught-panel';
import { HumanRepliesPanel } from '@/components/knowledge-base/human-replies-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CharCounter } from '@/components/knowledge-base/char-counter';
import { GapsPanel } from '@/components/knowledge-base/gaps-panel';
import { TestPanel } from '@/components/knowledge-base/test-panel';
import {
    isInstructions,
    KB_INSTRUCTIONS_CATEGORY,
    KB_MAX_CATEGORY_CHARS,
    KB_MAX_CHARS,
    KB_MAX_INSTRUCTIONS,
    KB_RETRIEVE_K,
    KB_SUGGESTED_CATEGORIES,
} from '@/lib/knowledge-base';
import {
    useGetKnowledgeChunksQuery,
    useGetKnowledgeStatsQuery,
    useCreateKnowledgeChunkMutation,
    useUpdateKnowledgeChunkMutation,
    useDeleteKnowledgeChunkMutation,
    type KnowledgeChunk,
} from '@/store/api/knowledgeBaseApi';

const TABS = ['entries', 'gaps', 'replies', 'taught', 'human', 'test'] as const;
type Tab = (typeof TABS)[number];
const SEARCHABLE: Tab[] = ['entries', 'gaps', 'replies', 'taught', 'human'];
const SEARCH_PLACEHOLDER: Record<Tab, string> = {
    entries: 'Search entries…',
    gaps: 'Search questions…',
    replies: 'Search replies or customers…',
    taught: 'Search taught replies…',
    human: 'Search human replies…',
    test: '',
};

function relativeTime(iso: string): string {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return new Date(iso).toLocaleDateString();
}

// ─── Add / Edit dialog ──────────────────────────────────────────────────────

function EntryFormDialog({
    open,
    onOpenChange,
    editing,
    initialText,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: KnowledgeChunk | null;
    initialText?: string; // Prefill for a new entry (e.g. an unanswered question).
}) {
    const [text, setText] = useState(editing?.text ?? '');
    const [category, setCategory] = useState(editing?.source ?? '');
    const [error, setError] = useState<string | null>(null);
    const [createChunk, { isLoading: isCreating }] = useCreateKnowledgeChunkMutation();
    const [updateChunk, { isLoading: isUpdating }] = useUpdateKnowledgeChunkMutation();
    const isSaving = isCreating || isUpdating;

    // Re-seed the form whenever a different entry is opened for editing (or
    // the dialog opens fresh for a new one).
    const [seen, setSeen] = useState({ editing, open, initialText });
    if (seen.editing !== editing || seen.open !== open || seen.initialText !== initialText) {
        setSeen({ editing, open, initialText });
        setText(editing?.text ?? initialText ?? '');
        setCategory(editing?.source ?? '');
        setError(null);
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!text.trim() || text.trim().length > KB_MAX_CHARS) return;
        setError(null);
        const result = editing
            ? await updateChunk({ id: editing.id, text: text.trim(), source: category.trim() || undefined })
            : await createChunk({ text: text.trim(), source: category.trim() || undefined });
        if ('error' in result) {
            setError(apiMessage(result.error, 'Something went wrong — please try again.'));
            return;
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit entry' : 'Add an entry'}</DialogTitle>
                    <DialogDescription>
                        The AI answers only from what&apos;s written here. Keep each entry to one topic.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="kb-text">Text</Label>
                        <Textarea
                            id="kb-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Our office hours are Sunday–Thursday, 9 AM–6 PM."
                            // Grows with the entry up to a fixed height, then scrolls.
                            className="min-h-28 max-h-72 overflow-y-auto"
                            required
                            autoFocus
                        />
                        <CharCounter length={text.length} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="kb-category">Category</Label>
                        <Input
                            id="kb-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            maxLength={KB_MAX_CATEGORY_CHARS}
                            list="kb-categories"
                            placeholder="Business Hours, Pricing, Services..."
                        />
                        <datalist id="kb-categories">
                            {KB_SUGGESTED_CATEGORIES.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                        {isInstructions(category) && (
                            <p className="text-xs text-muted-foreground">
                                A rule, not a fact: the AI follows every &quot;{KB_INSTRUCTIONS_CATEGORY}&quot; entry on every message
                                (tone, do&apos;s and don&apos;ts, when to hand off). Up to {KB_MAX_INSTRUCTIONS}.
                            </p>
                        )}
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving || !text.trim() || text.trim().length > KB_MAX_CHARS} className="gap-2">
                            {isSaving && <Loader2 className="size-4 animate-spin" />}
                            {editing ? 'Save changes' : 'Add entry'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── View dialog ────────────────────────────────────────────────────────────

function ViewEntryDialog({ chunk, onOpenChange }: { chunk: KnowledgeChunk | null; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={!!chunk} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Knowledge entry</DialogTitle>
                </DialogHeader>
                {chunk && (
                    <div className="space-y-3 pt-1">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{chunk.text}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {chunk.source && <Badge variant="outline">{chunk.source}</Badge>}
                            <span>{chunk.text.length} characters</span>
                            <span>Created {relativeTime(chunk.createdAt)}</span>
                            {chunk.createdByName && <span>by {chunk.createdByName}</span>}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
    return (
        <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
            <KnowledgeBase />
        </Suspense>
    );
}

// Tab, search, page, page size and each tab's sub-filter all live in the URL:
// /knowledge-base?tab=gaps&q=price&page=2&limit=50
function KnowledgeBase() {
    const url = useUrlState({ tab: 'entries', limit: '20' });
    const tab: Tab = (TABS as readonly string[]).includes(url.get('tab')) ? (url.get('tab') as Tab) : 'entries';
    const { page, limit } = readPaging(url.get);
    const view = url.get('view');
    const urlQ = url.get('q');

    const setTab = (next: string) => url.set({ tab: next, q: null, page: null, view: null });
    const setPage = (n: number) => url.set({ page: n });
    const setLimit = (n: number) => url.set({ limit: n, page: null });
    const setView = (v: string) => url.set({ view: v, page: null });

    const { data: stats } = useGetKnowledgeStatsQuery();
    const { data, isLoading, isFetching } = useGetKnowledgeChunksQuery({ page, limit, q: urlQ }, { skip: tab !== 'entries' });
    const [deleteChunk, { isLoading: isDeleting }] = useDeleteKnowledgeChunkMutation();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<KnowledgeChunk | null>(null);
    const [viewing, setViewing] = useState<KnowledgeChunk | null>(null);
    const [deleting, setDeleting] = useState<KnowledgeChunk | null>(null);
    const [prefill, setPrefill] = useState<string | undefined>();

    const pageItems = data?.items ?? [];
    const meta = data?.meta;
    useClampPage(page, tab === 'entries' ? meta?.totalPages : undefined, setPage);

    const gapCount = stats?.gaps ?? 0;
    const badge = (n: number | undefined) =>
        n ? <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">{n.toLocaleString()}</Badge> : null;

    const openAddDialog = (question?: string) => {
        setEditing(null);
        setPrefill(question ? `Q: ${question}\nA: ` : undefined);
        setFormOpen(true);
    };
    const openEditDialog = (chunk: KnowledgeChunk) => {
        setPrefill(undefined);
        setEditing(chunk);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await deleteChunk(deleting.id);
        setDeleting(null);
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Knowledge Base</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Facts and FAQs the WhatsApp AI grounds its replies on.
                    </p>
                </div>
                <Button onClick={() => openAddDialog()} className="gap-2 shrink-0">
                    <Plus className="size-4" />
                    Add entry
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Entries', value: stats?.total ?? '—', hint: `${stats?.rules ?? 0}/${KB_MAX_INSTRUCTIONS} AI rules` },
                    { label: 'Total characters', value: stats ? stats.chars.toLocaleString() : '—', hint: `the AI reads the ${KB_RETRIEVE_K} best matches per message` },
                    { label: 'Over the limit', value: stats?.over ?? '—', hint: `entries above ${KB_MAX_CHARS} characters`, warn: (stats?.over ?? 0) > 0 },
                    { label: 'Unanswered questions', value: stats?.gaps ?? '—', hint: 'waiting for an answer', warn: gapCount > 0 },
                ].map((c) => (
                    <div key={c.label} className="rounded-lg border bg-sidebar p-3">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        <p className={`text-xl font-semibold tabular-nums ${c.warn ? 'text-amber-600 dark:text-amber-400' : ''}`}>{c.value}</p>
                        <p className="text-[11px] text-muted-foreground">{c.hint}</p>
                    </div>
                ))}
            </div>

            <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <TabsList className="h-auto flex-wrap justify-start">
                    <TabsTrigger value="entries" className="gap-1.5">
                        Entries
                        {badge(stats?.total)}
                    </TabsTrigger>
                    <TabsTrigger value="gaps" className="gap-1.5">
                        Unanswered questions
                        {badge(stats?.gaps)}
                    </TabsTrigger>
                    <TabsTrigger value="replies" className="gap-1.5">
                        AI replies
                        {badge(stats?.replies)}
                    </TabsTrigger>
                    <TabsTrigger value="taught" className="gap-1.5">
                        Taught replies
                        {badge(stats?.taught)}
                    </TabsTrigger>
                    <TabsTrigger value="human" className="gap-1.5">
                        Human replies
                        {badge(stats?.humanNew)}
                    </TabsTrigger>
                    <TabsTrigger value="test">Test the AI</TabsTrigger>
                </TabsList>

                {SEARCHABLE.includes(tab) && (
                    <SearchInput key={tab} value={urlQ} placeholder={SEARCH_PLACEHOLDER[tab]} onSearch={(q) => url.set({ q, page: null })} />
                )}

                <TabsContent value="entries" className="flex flex-col gap-6">
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-xl" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-lg border bg-sidebar">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Text</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Length</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                    <BookOpen className="size-5 text-muted-foreground" />
                                                </div>
                                                {!urlQ && (stats?.total ?? 0) === 0 ? (
                                                    <>
                                                        <p className="text-sm font-medium text-foreground">No entries yet</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Click &quot;Add entry&quot; above to start grounding the AI&apos;s replies.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">No entries match your search.</p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pageItems.map((chunk) => (
                                        <TableRow key={chunk.id}>
                                            <TableCell className="max-w-sm whitespace-normal">
                                                <span className="line-clamp-2 text-sm">{chunk.text}</span>
                                            </TableCell>
                                            <TableCell>
                                                {chunk.source ? (
                                                    <Badge variant={isInstructions(chunk.source) ? 'secondary' : 'outline'}>
                                                        {chunk.source}
                                                    </Badge>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    chunk.text.length > KB_MAX_CHARS
                                                        ? 'text-xs font-medium text-destructive'
                                                        : 'text-xs text-muted-foreground tabular-nums'
                                                }
                                                title={chunk.text.length > KB_MAX_CHARS ? `Over the ${KB_MAX_CHARS}-character limit — shorten or split when you next edit it` : undefined}
                                            >
                                                {chunk.text.length} / {KB_MAX_CHARS}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {relativeTime(chunk.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {chunk.createdByName ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        onClick={() => setViewing(chunk)}
                                                    >
                                                        <Eye className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        onClick={() => openEditDialog(chunk)}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setDeleting(chunk)}
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {meta && meta.total > 0 && (
                        <PaginationBar
                            page={meta.page}
                            limit={meta.limit}
                            total={meta.total}
                            totalPages={meta.totalPages}
                            onPageChange={setPage}
                            onLimitChange={setLimit}
                            isLoading={isFetching}
                        />
                    )}
                </>
            )}

                </TabsContent>

                <TabsContent value="gaps">
                    <GapsPanel q={urlQ} page={page} limit={limit} onPage={setPage} onLimit={setLimit} onAnswer={(question) => openAddDialog(question)} />
                </TabsContent>

                <TabsContent value="replies">
                    <RepliesPanel q={urlQ} page={page} limit={limit} view={view} onPage={setPage} onLimit={setLimit} onView={setView} />
                </TabsContent>

                <TabsContent value="taught">
                    <TaughtPanel q={urlQ} page={page} limit={limit} onPage={setPage} onLimit={setLimit} />
                </TabsContent>

                <TabsContent value="human">
                    <HumanRepliesPanel q={urlQ} page={page} limit={limit} view={view} onPage={setPage} onLimit={setLimit} onView={setView} />
                </TabsContent>

                <TabsContent value="test">
                    <TestPanel />
                </TabsContent>
            </Tabs>

            <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} initialText={prefill} />
            <ViewEntryDialog chunk={viewing} onOpenChange={(open) => !open && setViewing(null)} />

            <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this knowledge entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The AI will no longer use it in replies. This can&apos;t be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="size-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
