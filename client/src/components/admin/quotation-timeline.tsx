'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import {
    useGetQuotationTimelineQuery,
    useRegenerateQuotationLinkMutation,
    useReplayQuotationGroupEventsMutation,
    type TimelineItem,
} from '@/redux/features/quotationTimeline/quotationTimelineApi';

function kindBadge(kind: TimelineItem['kind']): 'default' | 'secondary' | 'outline' {
    switch (kind) {
        case 'payment_event':
            return 'secondary';
        case 'outbox':
            return 'outline';
        case 'order':
            return 'default';
        case 'quotation':
        default:
            return 'outline';
    }
}

export function QuotationTimelineAdmin() {
    const [quotationGroupId, setQuotationGroupId] = React.useState('');
    const [submittedId, setSubmittedId] = React.useState<string | null>(null);

    const { data, isLoading, error, refetch } = useGetQuotationTimelineQuery(
        { quotationGroupId: submittedId ?? '' },
        { skip: !submittedId },
    );

    const [regenerateLink, { isLoading: isRegenerating }] = useRegenerateQuotationLinkMutation();
    const [replay, { isLoading: isReplaying }] = useReplayQuotationGroupEventsMutation();

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>Quotation Timeline</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Search by <span className="font-mono">quotationGroupId</span> to view the full quotation → payment → outbox → order timeline.
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="flex-1 space-y-2">
                        <div className="text-sm font-medium">quotationGroupId</div>
                        <div className="flex gap-2">
                            <Input
                                value={quotationGroupId}
                                onChange={(e) => setQuotationGroupId(e.target.value)}
                                placeholder="e.g. 2e5c2f7d-..."
                            />
                            <Button
                                onClick={() => setSubmittedId(quotationGroupId.trim() || null)}
                                disabled={!quotationGroupId.trim()}
                            >
                                Search
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => refetch()}
                                disabled={!submittedId || isLoading}
                            >
                                <RefreshCcw className="size-4" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            disabled={!submittedId || isRegenerating}
                            onClick={async () => {
                                if (!submittedId) return;
                                await regenerateLink({ quotationGroupId: submittedId }).unwrap();
                            }}
                        >
                            Regenerate link (async)
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!submittedId || isReplaying}
                            onClick={async () => {
                                if (!submittedId) return;
                                await replay({ quotationGroupId: submittedId, mode: 'failed_for_group' }).unwrap();
                            }}
                        >
                            Replay failed/dead-letter (async)
                        </Button>
                    </div>
                </div>

                {error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>Failed to load timeline. Check the group id and try again.</AlertDescription>
                    </Alert>
                ) : null}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Kind</TableHead>
                            <TableHead>Summary</TableHead>
                            <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-muted-foreground">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : !data?.items?.length ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-muted-foreground">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.items.map((it, idx) => (
                                <TableRow key={`${it.at}-${it.kind}-${idx}`}>
                                    <TableCell className="whitespace-nowrap">
                                        {new Date(it.at).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={kindBadge(it.kind)}>{it.kind}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[520px] truncate text-muted-foreground">
                                        {it.kind === 'outbox'
                                            ? String(it.data.eventName ?? 'outbox')
                                            : it.kind === 'payment_event'
                                                ? String(it.data.eventType ?? 'payment_event')
                                                : it.kind === 'order'
                                                    ? `order: ${String(it.data.status ?? '')}`
                                                    : `quotation: ${String(it.data.status ?? '')}`}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <details className="text-left">
                                            <summary className="cursor-pointer text-sm text-muted-foreground">
                                                view
                                            </summary>
                                            <pre className="mt-2 max-h-[240px] overflow-auto rounded-md bg-muted p-3 text-xs">
                                                {JSON.stringify(it.data, null, 2)}
                                            </pre>
                                        </details>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

