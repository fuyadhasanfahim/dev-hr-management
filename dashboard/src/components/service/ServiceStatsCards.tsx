import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Box, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { IService } from '@/types/order.type';

interface ServiceStatsCardsProps {
  services: (IService & { usageCount?: number })[];
  total: number;
}

export function ServiceStatsCards({ services, total }: ServiceStatsCardsProps) {
  const activeCount = services.filter((s) => s.isActive).length;
  const inactiveCount = services.filter((s) => !s.isActive).length;

  // Find the most used service (naive approach based on current page data, ideally from backend)
  const mostUsedService = [...services].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];
  const mostUsedName = mostUsedService ? mostUsedService.name : 'N/A';
  const mostUsedCount = mostUsedService?.usageCount || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Services */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Services</p>
              <h4 className="text-2xl font-bold text-slate-900">{total}</h4>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Services */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Active</p>
              <h4 className="text-2xl font-bold text-slate-900">{activeCount}</h4>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Services */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-500 rounded-lg">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Inactive</p>
              <h4 className="text-2xl font-bold text-slate-900">{inactiveCount}</h4>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Most Used */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Most Used</p>
              <h4 className="text-xl font-bold text-slate-900 truncate max-w-[120px]">{mostUsedName}</h4>
              <p className="text-xs text-slate-500">{mostUsedCount} orders</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
