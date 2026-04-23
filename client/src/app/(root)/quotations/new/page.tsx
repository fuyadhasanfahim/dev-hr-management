"use client"

import { useEffect } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import QuotationBuilder from '../components/forms/QuotationBuilder';
import { IconReceipt } from '@tabler/icons-react';

export default function NewQuotationPage() {
  const { reset } = useQuotationStore();

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100">
            <IconReceipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Quotation</h1>
            <p className="text-sm text-slate-500">Design a professional proposal for your client</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <QuotationBuilder />
      </div>
    </div>
  );
}
