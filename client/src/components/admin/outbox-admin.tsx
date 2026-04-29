'use client';

import * as React from 'react';
import {
    useListOutboxQuery,
    useReplayOutboxMutation,
    type OutboxEvent,
} from '@/redux/features/outbox/outboxApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type StatusFilter =
    | 'all'
    | 'pending'
    | 'processing'
    | 'processed'
    | 'failed'
    | 'dead_letter'
    | 'cancelled';

function statusBadgeVariant(status: string) {
    switch (status) {
        case 'processed':
            return 'secondary';
        case 'dead_letter':
            return 'destructive';
        case 'failed':
            return 'outline';
        case 'processing':
            return 'default';
        case 'pending':
        default:
            return 'outline';
    }
}

function canReplay(e: OutboxEvent) {
    return ['dead_letter', 'failed', 'cancelled'].includes(e.status);
}

export function OutboxAdmin() {
    const [status, setStatus] = React.useState<StatusFilter>('dead_letter');
    const { data, isLoading, error, refetch } = useListOutboxQuery({
        status: status === 'all' ? undefined : status,
        limit: 50,
    });
    const [replayOutbox, { isLoading: isReplaying }] = useReplayOutboxMutation();

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>Outbox Dead-letter + Replay</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Transactional events are stored in MongoDB and processed asynchronously.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dead_letter">dead_letter</SelectItem>
                            <SelectItem value="failed">failed</SelectItem>
                            <SelectItem value="pending">pending</SelectItem>
                            <SelectItem value="processing">processing</SelectItem>
                            <SelectItem value="processed">processed</SelectItem>
                            <SelectItem value="cancelled">cancelled</SelectItem>
                            <SelectItem value="all">all</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => refetch()}>
                        Refresh
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>
                            Failed to load outbox events. Please try again.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Attempts</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : (data?.items?.length ?? 0) === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground">
                                    No outbox events found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data!.items.map((e) => (
                                <TableRow key={e._id}>
                                    <TableCell>
                                        <Badge variant={statusBadgeVariant(e.status) as any}>
                                            {e.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[320px] truncate">
                                        {e.eventName}
                                    </TableCell>
                                    <TableCell>
                                        {e.attempts}/{e.maxAttempts}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(e.createdAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="max-w-[420px] truncate text-muted-foreground">
                                        {e.lastError || '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={!canReplay(e) || isReplaying}
                                            onClick={async () => {
                                                await replayOutbox({ id: e._id }).unwrap();
                                            }}
                                        >
                                            Replay
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <div className="text-xs text-muted-foreground">
                    Showing {data?.items?.length ?? 0} of {data?.total ?? 0}
                </div>
            </CardContent>
        </Card>
    );
}

