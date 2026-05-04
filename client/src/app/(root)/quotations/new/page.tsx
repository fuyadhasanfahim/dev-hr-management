'use client';

import { useEffect } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import QuotationBuilder from '../components/forms/QuotationBuilder';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';

export default function NewQuotationPage() {
    const { reset } = useQuotationStore();

    useEffect(() => {
        reset();
    }, [reset]);

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl text-slate-900 font-bold">
                        New Quotation
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                        Build secure, version-controlled quotations with custom
                        tech stacks, scope, and pricing.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
                <QuotationBuilder hideHeader />
            </div>
        </div>
    );
}
