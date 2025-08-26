import React, { useState, useEffect, cloneElement } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

export default function DataTable({
  children,
  data,
  total,
  isLoading,
  searchPlaceholder = "Search...",
  onSearch,
  onSort,
  onPageChange,
  title,
  emptyMessage = "No data found",
  emptyIcon,
  emptyAction,
  initialPerPage = 5,
  showPagination = true,
  showSearch = true,
  sortBy = "",
  sortOrder = "asc",
}) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      if (onPageChange) {
        onPageChange(1, perPage);
      }
    }
  }, [search]);

  const handleSearch = () => {
    onSearch(search);
  };

  const handleSort = (column) => {
    if (!onSort) return;

    let newSortOrder = "asc";

    if (sortBy === column) {
      // If same column, toggle order
      newSortOrder = sortOrder === "asc" ? "desc" : "asc";
    }

    onSort(column, newSortOrder);
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
    if (onPageChange) {
      onPageChange(1, newPerPage);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange(newPage, perPage);
    }
  };

  const renderSortArrows = (columnId) => {
    if (!onSort) return null;
    if(columnId==='role') return null; // Disable sorting for role column
    if(columnId==='permissions') return null; // Disable sorting for col column
    return (
      <div className="flex flex-col">

        <ChevronUp
          className={`w-3 h-3 ${sortBy === columnId && sortOrder === "asc" ? "text-[var(--primary)]" : "text-[var(--secondary-foreground)]"}`}
        />
        <ChevronDown
          className={`w-3 h-3 ${sortBy === columnId && sortOrder === "desc" ? "text-[var(--primary)]" : "text-[var(--secondary-foreground)]"}`}
        />
      </div>
    );
  };

  const renderPaginationButtons = () => {
    const totalPages = Math.ceil(total / perPage);
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            currentPage === i
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
          }`}>
          {i}
        </button>
      );
    }
    return pages;
  };

  // Process children to add sorting functionality to headers
  const processChildren = (children) => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === "thead") {
          return cloneElement(
            child,
            {},
            React.Children.map(child.props.children, (row) => {
              if (React.isValidElement(row) && row.type === "tr") {
                return cloneElement(
                  row,
                  {},
                  React.Children.map(row.props.children, (header) => {
                    if (React.isValidElement(header) && header.type === "th") {
                      const columnId = header.props.id;
                      const defaultHeaderClasses =
                        "px-6 py-4 text-left text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider";
                      const existingClasses = header.props.className || "";

                      if (columnId && onSort) {
                        return cloneElement(
                          header,
                          {
                            ...header.props,
                            className: `${defaultHeaderClasses} ${existingClasses} cursor-pointer`.trim(),
                          },
                          <div className="flex items-center gap-2" onClick={() => handleSort(columnId)}>
                            {header.props.children}
                            {renderSortArrows(columnId)}
                          </div>
                        );
                      } else {
                        // For non-sortable headers, just add the default styling
                        return cloneElement(header, {
                          ...header.props,
                          className: `${defaultHeaderClasses} ${existingClasses}`.trim(),
                        });
                      }
                    }
                    return header;
                  })
                );
              }
              return row;
            })
          );
        }

        if (child.type === "tbody") {
          if (isLoading) {
            // Count columns for loading colspan
            const headerCount = React.Children.toArray(children).reduce((count, c) => {
              if (React.isValidElement(c) && c.type === "thead") {
                const firstRow = React.Children.toArray(c.props.children)[0];
                if (React.isValidElement(firstRow) && firstRow.type === "tr") {
                  return React.Children.count(firstRow.props.children);
                }
              }
              return count;
            }, 0);

            return (
              <tbody className="divide-y divide-[var(--border)]">
                <Skeleton columns={headerCount} rows={perPage} />
              </tbody>
            );
          }

          if (data.length === 0) {
            // Count columns for empty colspan
            const headerCount = React.Children.toArray(children).reduce((count, c) => {
              if (React.isValidElement(c) && c.type === "thead") {
                const firstRow = React.Children.toArray(c.props.children)[0];
                if (React.isValidElement(firstRow) && firstRow.type === "tr") {
                  return React.Children.count(firstRow.props.children);
                }
              }
              return count;
            }, 0);

            return (
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td colSpan={headerCount} className="text-center py-12">
                    {emptyIcon && <div className="mx-auto mb-4">{emptyIcon}</div>}
                    <p className="text-[var(--secondary-foreground)] text-lg">No results found</p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </td>
                </tr>
              </tbody>
            );
          }

          return cloneElement(child, {
            ...child.props,
            className: "divide-y divide-[var(--border)]",
          });
        }
      }
      return child;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      {showSearch && (
        <div className="mb-6">
          <div className="flex gap-0 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--secondary-foreground)]" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-[var(--input)] border border-[var(--border)] 
                         rounded-l-lg border-r-0 text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                         transition-all duration-200"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)]
                       text-white rounded-r-lg font-medium transition-all duration-200
                       border border-[var(--primary)] hover:border-[var(--primary-hover)]
                       flex items-center justify-center">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden shadow-lg">
        {title && (
          <div className="p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              {title} ({isLoading ? "..." : data.length})
            </h2>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">{processChildren(children)}</table>
        </div>

        {/* Pagination Controls */}
        {showPagination && (
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[var(--secondary-foreground)]">Per Page:</label>
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(Number(e.target.value))}
                    className="px-3 py-1 bg-[var(--input)] border border-[var(--border)] rounded-lg
                             text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 
                             focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200">
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="text-sm text-[var(--secondary-foreground)]">
                  Showing {Math.min((currentPage - 1) * perPage + 1, total)} to {Math.min(currentPage * perPage, total)} of {total} entries
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]
                           text-[var(--secondary-foreground)] hover:text-[var(--foreground)]
                           hover:bg-[var(--secondary)] transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">{renderPaginationButtons()}</div>

                <button
                  onClick={() => handlePageChange(Math.min(Math.ceil(total / perPage), currentPage + 1))}
                  disabled={currentPage === Math.ceil(total / perPage)}
                  className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]
                           text-[var(--secondary-foreground)] hover:text-[var(--foreground)]
                           hover:bg-[var(--secondary)] transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
