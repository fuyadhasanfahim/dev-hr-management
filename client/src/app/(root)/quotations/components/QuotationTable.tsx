import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Edit2, FileText, Trash2, RefreshCcw, Loader2 } from "lucide-react";
import Link from "next/link";
import { QuotationData } from "@/types/quotation.type";
import { format } from "date-fns";

interface QuotationTableProps {
  quotations: QuotationData[];
  isLoading: boolean;
  onEdit: (quotation: QuotationData) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
  onStatusChange: (id: string, status: "draft" | "sent" | "accepted" | "rejected") => void;
  isConverting?: string | null;
  updatingId?: string | null;
}

export function QuotationTable({
  quotations,
  isLoading,
  onEdit,
  onDelete,
  onConvert,
  onStatusChange,
  isConverting,
  updatingId,
}: QuotationTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Quotation #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-slate-500">Quotation #</TableHead>
            <TableHead className="font-medium text-slate-500">Client</TableHead>
            <TableHead className="font-medium text-slate-500">Service</TableHead>
            <TableHead className="font-medium text-slate-500">Total</TableHead>
            <TableHead className="font-medium text-slate-500 text-center">Status</TableHead>
            <TableHead className="font-medium text-slate-500">Date</TableHead>
            <TableHead className="font-medium text-slate-500 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 bg-slate-50 rounded-full text-slate-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <p className="text-base font-medium text-slate-900">No quotations yet</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            quotations.map((q) => {
              const statusColors = {
                draft: "bg-slate-100 text-slate-700 border-slate-200",
                sent: "bg-blue-50 text-blue-700 border-blue-200",
                accepted: "bg-teal-50 text-teal-700 border-teal-200",
                rejected: "bg-red-50 text-red-700 border-red-200",
              };

              return (
                <TableRow key={q._id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-mono text-slate-900 font-medium">
                    {q.quotationNumber}
                  </TableCell>
                  <TableCell className="text-slate-900 font-medium">
                    {(q.clientId as unknown as { name: string })?.name || q.client.contactName}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {q.serviceType === 'web-development' ? 'Web Design & Dev' : 'Photography'}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    {q.settings.currency}{q.totals.grandTotal.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {updatingId === q._id ? (
                      <div className="flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <Select
                        value={q.status || 'draft'}
                        onValueChange={(val) => q._id && onStatusChange(q._id, val as "draft" | "sent" | "accepted" | "rejected")}
                      >
                        <SelectTrigger className={`h-7 w-[100px] mx-auto border-none shadow-none focus:ring-0 ${statusColors[q.status || 'draft']} capitalize font-semibold text-[11px] rounded-full px-2.5`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[120px]">
                          <SelectItem value="draft" className="text-xs capitalize">Draft</SelectItem>
                          <SelectItem value="sent" className="text-xs capitalize">Sent</SelectItem>
                          <SelectItem value="accepted" className="text-xs capitalize text-teal-600">Accepted</SelectItem>
                          <SelectItem value="rejected" className="text-xs capitalize text-red-600">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {format(new Date(q.createdAt || new Date), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" asChild>
                        <Link href={`/quotations/${q._id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {q.status === 'accepted' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => q._id && onConvert(q._id)}
                          disabled={!!q.orderId || isConverting === q._id}
                          title={q.orderId ? "Already converted to order" : "Convert to Order"}
                        >
                          {isConverting === q._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-teal-600"
                        onClick={() => onEdit(q)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => q._id && onDelete(q._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
