/**
 * React Query shared hooks for data fetching.
 *
 * Three hooks cover all page patterns:
 *   - usePaginatedList  — paginated tables (company, customer, role, user, vehicle, documents, InvoiceJobs)
 *   - useApiMutation    — create / update / delete with auto-invalidation
 *   - useStaticOptions  — dropdown data (brands, customers, suggestions) cached indefinitely
 *
 * All hooks use the existing API() function from wrapper.js.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { API } from "@/hooks/wrapper";

// ── Query Key Factory ──

export const queryKeys = {
  companies: (params) => ["companies", params],
  customers: (params) => ["customers", params],
  roles: (params) => ["roles", params],
  users: (params) => ["users", params],
  vehicles: (params) => ["vehicles", params],
  documents: (params) => ["documents", params],
  invoiceJobs: (params) => ["invoiceJobs", params],
  accuracy: (params) => ["accuracy", params],
  prompts: () => ["prompts"],
  evaluation: () => ["evaluation"],
  // Static options (dropdown data — cached indefinitely)
  brands: () => ["brands"],
  customerOptions: () => ["customerOptions"],
  suggestions: (fields) => ["suggestions", fields],
  permissions: () => ["permissions"],
  companyOptions: () => ["companyOptions"],
  roleOptions: () => ["roleOptions"],
  exportTemplates: (params) => ["exportTemplates", params],
};

// ── Internal: Debounce Hook ──

function useDebounce(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't debounce on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDebounced(value);
      return;
    }

    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }

    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ── usePaginatedList ──

/**
 * Hook for paginated, sortable, searchable lists.
 *
 * @param {Function} keyFn    — queryKeys.xxx function
 * @param {string}   endpoint — API endpoint name (e.g. "customer", "vehicle")
 * @param {Object}   options
 * @param {number}   options.defaultPerPage  — default 5
 * @param {string}   options.defaultSort     — default "id"
 * @param {string}   options.defaultOrder    — default "asc"
 * @param {number}   options.debounceMs      — debounce query key changes (for filters)
 * @param {boolean}  options.enabled         — disable automatic fetching
 * @param {Function} options.buildParams     — (baseParams) => URLSearchParams — for extra params
 * @param {Function} options.select          — (apiResponse) => { items, total, extra }
 *
 * @returns {{ items, total, isLoading, error, page, perPage, setPage, setPerPage,
 *             search, handleSearch, sortBy, sortOrder, handleSort, handlePageChange,
 *             extra, refetch }}
 */
export function usePaginatedList(keyFn, endpoint, options = {}) {
  const {
    defaultPerPage = 5,
    defaultSort = "id",
    defaultOrder = "asc",
    debounceMs = 0,
    enabled = true,
    buildParams,
    select,
  } = options;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortOrder, setSortOrder] = useState(defaultOrder);

  // Build the base params object (used for query key)
  const baseParams = useMemo(
    () => ({ page, limit: perPage, search, sortBy, sortOrder }),
    [page, perPage, search, sortBy, sortOrder]
  );

  // Debounce for filter-heavy pages (vehicle)
  const queryParams = useDebounce(baseParams, debounceMs);

  // Build URLSearchParams from the query params + any extras
  const urlParams = useMemo(() => {
    const p = new URLSearchParams({
      page: String(queryParams.page),
      limit: String(queryParams.limit),
      search: queryParams.search,
      sortBy: queryParams.sortBy,
      sortOrder: queryParams.sortOrder,
    });
    if (buildParams) {
      buildParams(p, queryParams);
    }
    return p;
  }, [queryParams, buildParams]);

  const queryKey = useMemo(() => keyFn(queryParams), [queryParams, keyFn]);

  const { data: raw, isLoading, error: queryError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await API("GET", `${endpoint}?${urlParams}`);
      if (res.error) throw new Error(res.error);
      return res;
    },
    enabled,
  });

  // Extract items + total from API response
  const { items, total, extra } = useMemo(() => {
    if (!raw) return { items: [], total: 0, extra: {} };
    if (select) return select(raw);
    // Default: look for common response shapes
    // e.g. { customer: [...], total: N } or { data: [...], total: N } or { vehicles: [...], total: N }
    const arrayKey = Object.keys(raw).find(
      (k) => Array.isArray(raw[k]) && k !== "error"
    );
    return {
      items: arrayKey ? raw[arrayKey] : [],
      total: raw.total || (arrayKey ? raw[arrayKey].length : 0),
      extra: raw,
    };
  }, [raw, select]);

  // Error as string (React Query errors or API errors)
  const error = queryError?.message || "";

  // Handlers
  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handlePageChange = (newPage, newPerPage) => {
    setPage(newPage);
    setPerPage(newPerPage);
  };

  return {
    items,
    total,
    isLoading,
    error,
    extra,
    // Pagination
    page,
    perPage,
    setPage,
    setPerPage,
    // Search
    search,
    handleSearch,
    // Sort
    sortBy,
    sortOrder,
    handleSort,
    // Combined handler for DataTable
    handlePageChange,
    // Refetch
    refetch,
  };
}

// ── useApiMutation ──

/**
 * Wrapper around useMutation that auto-invalidates query keys on success.
 *
 * @param {string}   method         — HTTP method (PUT, POST, DELETE, PATCH)
 * @param {string}   endpoint       — API endpoint name
 * @param {Object}   options
 * @param {string[]} options.invalidateKeys — top-level query keys to invalidate (e.g. ["customers"])
 * @param {Function} options.onSuccess      — (data) => void — called after invalidation
 * @param {Function} options.onError        — (error) => void
 *
 * @returns {import("@tanstack/react-query").UseMutationResult}
 */
export function useApiMutation(method, endpoint, options = {}) {
  const { invalidateKeys, onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body) => {
      const res = await API(method, endpoint, body);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (data) => {
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
      onSuccess?.(data);
    },
    onError: (err) => {
      onError?.(err);
    },
  });
}

// ── useStaticOptions ──

/**
 * Fetch static data (brands, customer list, suggestions) with infinite cache.
 * Re-fetches only on explicit invalidation.
 *
 * @param {any[]}    queryKey   — React Query key
 * @param {string}   endpoint   — API endpoint
 * @param {Function} transform  — (apiResponse) => transformed data
 * @param {Object}   options
 * @param {boolean}  options.enabled — default true
 *
 * @returns {any} — transformed data (or empty result from transform(undefined))
 */
export function useStaticOptions(queryKey, endpoint, transform, options = {}) {
  const { enabled = true } = options;

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await API("GET", endpoint);
      if (res.error) throw new Error(res.error);
      return res;
    },
    staleTime: Infinity,
    enabled,
  });

  return useMemo(() => transform(data), [data]);
}
