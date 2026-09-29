'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  createPageUrl?: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
  showPrevOnFirstPage?: boolean;
}

export function generatePaginationRange(
  current: number,
  total: number
): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // If current is near the beginning (e.g. 1 or 2)
  if (current <= 2) {
    return [1, 2, '...', total];
  }

  // If current is near the end
  if (current >= total - 1) {
    return [1, '...', total - 1, total];
  }

  // In the middle
  return [1, '...', current, '...', total];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  createPageUrl,
  onPageChange,
  className = '',
  showPrevOnFirstPage = false,
}) => {
  if (totalPages <= 1) return null;

  const validCurrent = Math.max(1, Math.min(currentPage, totalPages));
  const pages = generatePaginationRange(validCurrent, totalPages);

  const renderButton = (
    pageNum: number,
    label: React.ReactNode,
    isActive: boolean
  ) => {
    const activeClasses =
      'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20 border-transparent';
    const inactiveClasses =
      'bg-[#121319] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800/90 hover:border-zinc-700';

    const baseClasses = `h-9 min-w-9 px-2 sm:h-10 sm:min-w-10 sm:px-3 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold transition-all select-none ${
      isActive ? activeClasses : inactiveClasses
    }`;

    if (createPageUrl) {
      return (
        <Link
          key={`page-${pageNum}`}
          href={createPageUrl(pageNum)}
          onClick={(e) => {
            if (onPageChange) {
              onPageChange(pageNum);
            }
          }}
          className={baseClasses}
          aria-current={isActive ? 'page' : undefined}
        >
          {label}
        </Link>
      );
    }

    return (
      <button
        key={`page-${pageNum}`}
        type="button"
        onClick={() => onPageChange?.(pageNum)}
        className={baseClasses}
        aria-current={isActive ? 'page' : undefined}
      >
        {label}
      </button>
    );
  };

  const renderNavArrow = (
    targetPage: number,
    icon: React.ReactNode,
    isDisabled: boolean,
    label: string
  ) => {
    const baseClasses = `h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-zinc-300 border border-zinc-800/90 transition-all ${
      isDisabled
        ? 'opacity-30 cursor-not-allowed pointer-events-none bg-[#121319]'
        : 'bg-[#121319] hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
    }`;

    if (createPageUrl && !isDisabled) {
      return (
        <Link
          href={createPageUrl(targetPage)}
          onClick={() => onPageChange?.(targetPage)}
          className={baseClasses}
          aria-label={label}
        >
          {icon}
        </Link>
      );
    }

    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onPageChange?.(targetPage)}
        className={baseClasses}
        aria-label={label}
      >
        {icon}
      </button>
    );
  };

  return (
    <nav
      className={`flex items-center justify-center gap-1.5 sm:gap-2 my-8 select-none ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Previous Page Chevron - hidden on page 1 unless showPrevOnFirstPage is true */}
      {(showPrevOnFirstPage || validCurrent > 1) &&
        renderNavArrow(
          validCurrent - 1,
          <ChevronLeft className="w-4 h-4 text-zinc-300" />,
          validCurrent <= 1,
          'Previous Page'
        )}

      {/* Numbered Page Buttons & Ellipses */}
      {pages.map((p, idx) => {
        if (typeof p === 'string') {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="h-9 w-6 sm:h-10 sm:w-8 flex items-center justify-center text-zinc-500 text-xs sm:text-sm font-semibold select-none"
            >
              ...
            </span>
          );
        }

        const isCurrent = p === validCurrent;
        return renderButton(p, p, isCurrent);
      })}

      {/* Next Page Chevron */}
      {renderNavArrow(
        validCurrent + 1,
        <ChevronRight className="w-4 h-4 text-zinc-300" />,
        validCurrent >= totalPages,
        'Next Page'
      )}
    </nav>
  );
};

export default Pagination;
