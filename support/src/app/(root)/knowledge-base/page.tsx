'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Eye, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    useGetKnowledgeChunksQuery,
    useCreateKnowledgeChunkMutation,
    useUpdateKnowledgeChunkMutation,
    useDeleteKnowledgeChunkMutation,
    type KnowledgeChunk,
} from '@/store/api/knowledgeBaseApi';

const PAGE_SIZE = 10;

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
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: KnowledgeChunk | null;
}) {
    const [text, setText] = useState(editing?.text ?? '');
    const [category, setCategory] = useState(editing?.source ?? '');
    const [error, setError] = useState<string | null>(null);
    const [createChunk, { isLoading: isCreating }] = useCreateKnowledgeChunkMutation();
    const [updateChunk, { isLoading: isUpdating }] = useUpdateKnowledgeChunkMutation();
    const isSaving = isCreating || isUpdating;

    // Re-seed the form whenever a different entry is opened for editing (or
    // the dialog opens fresh for a new one).
    useEffect(() => {
        setText(editing?.text ?? '');
        setCategory(editing?.source ?? '');
        setError(null);
    }, [editing, open]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        setError(null);
        const result = editing
            ? await updateChunk({ id: editing.id, text: text.trim(), source: category.trim() || undefined })
            : await createChunk({ text: text.trim(), source: category.trim() || undefined });
        if ('error' in result) {
            const message =
                (result.error as any)?.data?.message || 'Something went wrong — please try again.';
            setError(message);
            return;
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editing ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
                        {editing ? 'Edit entry' : 'Add an entry'}
                    </DialogTitle>
                    <DialogDescription>
                        Facts and FAQs the WhatsApp AI grounds its replies on. Be specific — the AI answers
                        only from what&apos;s written here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="kb-text">Text</Label>
                        <Textarea
                            id="kb-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="e.g. Our office working hours are Sunday to Thursday, 9 AM to 6 PM Bangladesh Standard Time."
                            rows={4}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="kb-category">Category</Label>
                        <Input
                            id="kb-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="e.g. Business Hours, Pricing, Services, Payments"
                        />
                        <p className="text-xs text-muted-foreground">
                            What kind of information is this? Helps you find it again later.
                        </p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving || !text.trim()} className="gap-2">
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
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="size-5 text-primary" />
                        Knowledge entry
                    </DialogTitle>
                </DialogHeader>
                {chunk && (
                    <div className="space-y-3 pt-1">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{chunk.text}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {chunk.source && <Badge variant="outline">{chunk.source}</Badge>}
                            <span>Added {relativeTime(chunk.createdAt)}</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
    const { data: chunks = [], isLoading } = useGetKnowledgeChunksQuery();
    const [deleteChunk, { isLoading: isDeleting }] = useDeleteKnowledgeChunkMutation();

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<KnowledgeChunk | null>(null);
    const [viewing, setViewing] = useState<KnowledgeChunk | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return chunks;
        return chunks.filter(
            (c) => c.text.toLowerCase().includes(q) || (c.source ?? '').toLowerCase().includes(q),
        );
    }, [chunks, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const openAddDialog = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEditDialog = (chunk: KnowledgeChunk) => {
        setEditing(chunk);
        setFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Remove this knowledge entry? The AI will no longer use it in replies.')) return;
        await deleteChunk(id);
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
                <Button onClick={openAddDialog} className="gap-2 shrink-0">
                    <Plus className="size-4" />
                    Add entry
                </Button>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <BookOpen className="size-4 text-primary" />
                            Entries
                        </CardTitle>
                        <CardDescription>{filtered.length} of {chunks.length} indexed</CardDescription>
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search entries..."
                            className="pl-8 h-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : chunks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <BookOpen className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No entries yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Click &quot;Add entry&quot; above to start grounding the AI&apos;s replies.
                            </p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No entries match your search.</p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Text</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Added</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pageItems.map((chunk) => (
                                        <TableRow key={chunk.id}>
                                            <TableCell className="max-w-sm whitespace-normal">
                                                <span className="line-clamp-2 text-sm">{chunk.text}</span>
                                            </TableCell>
                                            <TableCell>
                                                {chunk.source ? <Badge variant="outline">{chunk.source}</Badge> : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {relativeTime(chunk.createdAt)}
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
                                                        onClick={() => handleDelete(chunk.id)}
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                    <p className="text-xs text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => p - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
            <ViewEntryDialog chunk={viewing} onOpenChange={(open) => !open && setViewing(null)} />
        </div>
    );
}
