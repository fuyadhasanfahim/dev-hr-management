import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ServiceFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  pricingFilter: string;
  setPricingFilter: (val: string) => void;
  limit: number;
  setLimit: (val: number) => void;
}

export function ServiceFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  pricingFilter,
  setPricingFilter,
  limit,
  setLimit,
}: ServiceFiltersProps) {
  
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPricingFilter('all');
    setLimit(20);
  };

  const hasActiveFilters = search || statusFilter !== 'all' || pricingFilter !== 'all' || limit !== 20;

  return (
    <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
      {/* Search */}
      <div className="relative w-full xl:w-72 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white border-slate-200 focus-visible:ring-teal-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white border-slate-200 focus-visible:ring-teal-500 text-slate-600">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={pricingFilter} onValueChange={setPricingFilter}>
          <SelectTrigger className="w-[160px] bg-white border-slate-200 focus-visible:ring-teal-500 text-slate-600">
            <SelectValue placeholder="Pricing Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pricing</SelectItem>
            <SelectItem value="fixed">Fixed Price</SelectItem>
            <SelectItem value="hourly">Hourly Rate</SelectItem>
            <SelectItem value="milestone">Milestone Based</SelectItem>
          </SelectContent>
        </Select>

        <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
          <SelectTrigger className="w-[120px] bg-white border-slate-200 focus-visible:ring-teal-500 text-slate-600">
            <SelectValue placeholder="Rows: 20" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            onClick={handleClearFilters}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 h-9 px-3"
          >
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
