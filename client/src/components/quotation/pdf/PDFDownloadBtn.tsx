'use client';

import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { QuotationPDF } from './QuotationPDF';
import { QuotationData } from '@/types/quotation.type';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  data: QuotationData;
}

export default function PDFDownloadBtn({ data }: Props) {
  return (
    <PDFDownloadLink
      document={
        <QuotationPDF data={data} />
      }
      fileName={`${data.quotationNumber || data.details.title || 'Quotation'}.pdf`}
    >
      {({ loading }) => (
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
          {loading ? (
            <span className="flex items-center"><Download className="w-4 h-4 animate-bounce" /> Generating...</span>
          ) : (
            <span className="flex items-center"><FileText className="w-4 h-4" /> Download PDF</span>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
