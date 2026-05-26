import React from 'react';
import { IService } from '@/types/order.type';
import { format } from 'date-fns';
import { Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServiceTableProps {
  data: IService[];
  isLoading: boolean;
  onEdit: (service: IService & { usageCount: number }) => void;
  onDelete: (service: IService & { usageCount: number }) => void;
  onToggleStatus: (service: IService) => void;
}

export function ServiceTable({ data, isLoading, onEdit, onDelete, onToggleStatus }: ServiceTableProps) {
  
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-100 rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-lg font-medium text-slate-900">No services found</p>
        <p className="text-sm mt-1">Try adjusting your filters or create a new service.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
            <TableHead className="font-semibold text-slate-600">Service Name</TableHead>
            <TableHead className="font-semibold text-slate-600">Category</TableHead>
            <TableHead className="font-semibold text-slate-600">Pricing Model</TableHead>
            <TableHead className="font-semibold text-slate-600">Base Price</TableHead>
            <TableHead className="font-semibold text-slate-600">Status</TableHead>
            <TableHead className="font-semibold text-slate-600">Created At</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((service) => (
            <TableRow key={service._id} className="border-slate-100 hover:bg-slate-50/80 transition-colors">
              <TableCell>
                <div className="font-medium text-slate-900">{service.name}</div>
                {service.description && (
                  <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">
                    {service.description}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span className="capitalize text-slate-600">{service.category || 'N/A'}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize font-normal text-slate-600 border-slate-200">
                  {service.pricingModel || 'Fixed'}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-slate-700">
                {service.pricingModel === 'fixed' || !service.pricingModel
                  ? `$${service.basePrice?.toFixed(2) || '0.00'}`
                  : service.pricingModel === 'hourly'
                  ? `$${service.hourlyRate?.toFixed(2) || '0.00'}/hr`
                  : 'Custom'}
              </TableCell>
              <TableCell>
                {service.isActive ? (
                  <Badge className="bg-teal-50 text-teal-700 border-teal-200/50 hover:bg-teal-100 font-medium">
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-orange-50 text-orange-700 border-orange-200/50 hover:bg-orange-100 font-medium">
                    Inactive
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-slate-500 text-sm">
                {service.createdAt ? format(new Date(service.createdAt), 'MMM d, yyyy') : 'N/A'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleStatus(service)}
                    className={service.isActive ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50" : "text-teal-600 hover:text-teal-700 hover:bg-teal-50"}
                    title={service.isActive ? "Deactivate" : "Activate"}
                  >
                    {service.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(service as IService & { usageCount: number })}
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(service as IService & { usageCount: number })}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
