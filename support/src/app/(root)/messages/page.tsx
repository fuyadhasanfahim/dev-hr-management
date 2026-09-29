'use client';

import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function MessagesPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight">Your Messages</h1>
                <p className="text-sm text-muted-foreground mt-0.5">All WhatsApp conversations in one place.</p>
            </div>

            <Card className="shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <MessageCircle className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Coming soon</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        A unified WhatsApp message log is on the way.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
