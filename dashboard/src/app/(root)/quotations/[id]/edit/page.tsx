'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGetQuotationByIdQuery } from '@/redux/features/quotation/quotationApi';
import { useQuotationStore } from '@/store/useQuotationStore';
import QuotationBuilder from '../../components/forms/QuotationBuilder';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EditQuotationPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useGetQuotationByIdQuery(id as string);
  const { setData } = useQuotationStore();
  const router = useRouter();
  const isLoadedRef = useRef(false);

  const [sanitizedData, setSanitizedData] = useState<any>(null);

  useEffect(() => {
    isLoadedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (data && !isLoadedRef.current) {
      isLoadedRef.current = true;
      const sanitized = {
        ...data,
        clientId:
          typeof data.clientId === 'object'
            ? (data.clientId as { _id: string })?._id
            : data.clientId,
        details: {
          ...data.details,
          date: data.details?.date
            ? new Date(data.details.date).toISOString().split('T')[0]
            : '',
          validUntil: data.details?.validUntil
            ? new Date(data.details.validUntil).toISOString().split('T')[0]
            : '',
        },
      };
      setSanitizedData(sanitized);
      setData(sanitized);
    }
  }, [data, setData]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto p-6 text-center mt-20">
        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">Error loading quotation</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn&apos;t load this quotation. It may have been deleted or the
            link is incorrect.
          </p>
          <Button variant="outline" onClick={() => router.push('/quotations')}>
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {data.status !== 'draft' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              This quotation has already been sent
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Changes will update the existing quotation. The client&apos;s link will reflect the updated content.
            </p>
          </div>
        </div>
      )}

      <QuotationBuilder
        pageTitle="Edit Quotation"
        pageSubtitle={`${data?.details?.title || 'Untitled'} • #${data?.quotationNumber || '—'}`}
        backUrl={`/quotations/${id}`}
        initialData={sanitizedData || data}
      />
    </div>
  );
}
