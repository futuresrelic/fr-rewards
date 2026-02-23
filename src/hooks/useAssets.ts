'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchAssets, fetchCollectionsByOwner, fetchAccountStats } from '@/lib/atomicassets';
import { useFilterStore } from '@/store/filterStore';
import { ASSETS_PER_PAGE } from '@/lib/constants';
import { debugLog } from '@/lib/utils';
import type { AtomicAsset } from '@/lib/types';

// ---- Fetch single page of assets ----
export function useAssets(account: string | null) {
  const { filters, sort, page } = useFilterStore();

  return useQuery({
    queryKey: ['assets', account, filters, sort, page],
    queryFn: async () => {
      if (!account) return { assets: [], total: 0 };
      debugLog('info', `Fetching assets for ${account} page ${page}`);
      return fetchAssets({ owner: account, page, filters, sort, limit: ASSETS_PER_PAGE });
    },
    enabled: !!account,
    staleTime: 30_000, // 30 seconds
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

// ---- Infinite scroll assets ----
export function useInfiniteAssets(account: string | null) {
  const { filters, sort } = useFilterStore();

  return useInfiniteQuery({
    queryKey: ['assets-infinite', account, filters, sort],
    queryFn: async ({ pageParam = 1 }) => {
      if (!account) return { assets: [], total: 0 };
      debugLog('info', `Fetching page ${pageParam} for ${account}`);
      return fetchAssets({
        owner: account,
        page: pageParam as number,
        filters,
        sort,
        limit: ASSETS_PER_PAGE,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.assets.length < ASSETS_PER_PAGE) return undefined;
      return allPages.length + 1;
    },
    enabled: !!account,
    staleTime: 30_000,
  });
}

// ---- All assets flattened from infinite query ----
export function useAllAssets(account: string | null): AtomicAsset[] {
  const query = useInfiniteAssets(account);
  return query.data?.pages.flatMap((p) => p.assets) ?? [];
}

// ---- Unique collections for the wallet ----
export function useWalletCollections(account: string | null) {
  return useQuery({
    queryKey: ['wallet-collections', account],
    queryFn: () => {
      if (!account) return [];
      return fetchCollectionsByOwner(account);
    },
    enabled: !!account,
    staleTime: 60_000,
  });
}

// ---- Account stats ----
export function useAccountStats(account: string | null) {
  return useQuery({
    queryKey: ['account-stats', account],
    queryFn: () => {
      if (!account) return { assets: 0, collections: 0, schemas: 0, templates: 0 };
      return fetchAccountStats(account);
    },
    enabled: !!account,
    staleTime: 60_000,
  });
}
