"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function getPageNumbers(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);

  return pages;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalCount,
  perPage,
  noun = "runs",
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  perPage: number;
  noun?: string;
  buildHref?: (page: number) => string;
}) {
  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, totalCount);
  const singular = noun.endsWith("s") ? noun.slice(0, -1) : noun;
  const href = (page: number) =>
    buildHref ? buildHref(page) : `?page=${page}`;

  if (totalPages <= 1) {
    return (
      <p className="pt-4 text-sm text-muted-foreground">
        {totalCount} {totalCount === 1 ? singular : noun} total
      </p>
    );
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col items-center gap-2 pt-4 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalCount} {noun}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {currentPage > 1 ? (
              <PaginationPrevious href={href(currentPage - 1)} />
            ) : (
              <PaginationPrevious
                href={href(1)}
                aria-disabled="true"
                tabIndex={-1}
                className="pointer-events-none opacity-50"
              />
            )}
          </PaginationItem>

          {pageNumbers.map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href={href(page)}
                  isActive={page === currentPage}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            {currentPage < totalPages ? (
              <PaginationNext href={href(currentPage + 1)} />
            ) : (
              <PaginationNext
                href={href(totalPages)}
                aria-disabled="true"
                tabIndex={-1}
                className="pointer-events-none opacity-50"
              />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
