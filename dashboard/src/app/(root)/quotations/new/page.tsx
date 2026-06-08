'use client';

import { useEffect } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import QuotationBuilder from '../components/forms/QuotationBuilder';
import { ReceiptText } from 'lucide-react';

export default function NewQuotationPage() {
    const { reset } = useQuotationStore();

    useEffect(() => {
        reset();
    }, [reset]);

    return (
        <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
            {/* Header (consistent with edit / view pages) */}
            <div className="flex items-center gap-3">
                <ReceiptText className="h-5 w-5 text-muted-foreground" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        New Quotation
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Build secure, version-controlled quotations with custom
                        scope and pricing.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
                <QuotationBuilder hideHeader />
            </div>
        </div>
    );
}
