'use client';

import { useEffect } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import QuotationBuilder from '../components/forms/QuotationBuilder';

export default function NewQuotationPage() {
    const { reset } = useQuotationStore();

    useEffect(() => {
        reset();
    }, [reset]);

    return (
        <div className="animate-in fade-in duration-300">
            <QuotationBuilder hideHeader />
        </div>
    );
}
