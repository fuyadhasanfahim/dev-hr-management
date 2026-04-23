import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ServicePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function ServicePagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: ServicePaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show (with ellipsis logic)
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1 || isLoading}
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isLoading}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 px-2">
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                ...
              </span>
            );
          }

          const isCurrentPage = page === currentPage;
          return (
            <Button
              key={`page-${page}`}
              variant={isCurrentPage ? 'default' : 'ghost'}
              className={`h-8 w-8 p-0 ${
                isCurrentPage
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              onClick={() => onPageChange(page as number)}
              disabled={isLoading}
            >
              {page}
            </Button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || isLoading}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages || isLoading}
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
