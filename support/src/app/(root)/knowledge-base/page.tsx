'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Eye,
    Loader2,
    Pencil,
    Plus,
    Search,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    useGetKnowledgeChunksQuery,
    useCreateKnowledgeChunkMutation,
    useUpdateKnowledgeChunkMutation,
    useDeleteKnowledgeChunkMutation,
    type KnowledgeChunk,
} from '@/store/api/knowledgeBaseApi';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

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
                    <DialogTitle>{editing ? 'Edit entry' : 'Add an entry'}</DialogTitle>
                    <DialogDescription>The AI answers only from what&apos;s written here.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="kb-text">Text</Label>
                        <Textarea
                            id="kb-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Our office hours are Sunday–Thursday, 9 AM–6 PM."
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
                            placeholder="Business Hours, Pricing, Services..."
                        />
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
                    <DialogTitle>Knowledge entry</DialogTitle>
                </DialogHeader>
                {chunk && (
                    <div className="space-y-3 pt-1">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{chunk.text}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {chunk.source && <Badge variant="outline">{chunk.source}</Badge>}
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
    const { data: chunks = [], isLoading } = useGetKnowledgeChunksQuery();
    const [deleteChunk, { isLoading: isDeleting }] = useDeleteKnowledgeChunkMutation();

    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [page, setPage] = useState(1);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<KnowledgeChunk | null>(null);
    const [viewing, setViewing] = useState<KnowledgeChunk | null>(null);
    const [deleting, setDeleting] = useState<KnowledgeChunk | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return chunks;
        return chunks.filter((c) => c.text.toLowerCase().includes(q) || (c.source ?? '').toLowerCase().includes(q));
    }, [chunks, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const openAddDialog = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEditDialog = (chunk: KnowledgeChunk) => {
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
                <Button onClick={openAddDialog} className="gap-2 shrink-0">
                    <Plus className="size-4" />
                    Add entry
                </Button>
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
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                    <BookOpen className="size-5 text-muted-foreground" />
                                                </div>
                                                {chunks.length === 0 ? (
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
                                                {chunk.source ? <Badge variant="outline">{chunk.source}</Badge> : '—'}
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

                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium text-muted-foreground">
                                Rows per page
                            </Label>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(value) => {
                                    setPageSize(Number(value));
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue placeholder={pageSize} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <SelectItem key={size} value={String(size)}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-sm font-medium">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="size-8"
                                    size="icon"
                                    onClick={() => setPage(1)}
                                    disabled={currentPage <= 1}
                                >
                                    <span className="sr-only">Go to first page</span>
                                    <ChevronsLeft />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="size-8"
                                    size="icon"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                >
                                    <span className="sr-only">Go to previous page</span>
                                    <ChevronLeft />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="size-8"
                                    size="icon"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    <span className="sr-only">Go to next page</span>
                                    <ChevronRight />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="size-8"
                                    size="icon"
                                    onClick={() => setPage(totalPages)}
                                    disabled={currentPage >= totalPages}
                                >
                                    <span className="sr-only">Go to last page</span>
                                    <ChevronsRight />
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
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
