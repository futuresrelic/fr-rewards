'use client';

import { create } from 'zustand';
import type { AssetFilters, AssetSortOptions, ViewMode } from '@/lib/types';

interface FilterStore {
  filters: AssetFilters;
  sort: AssetSortOptions;
  viewMode: ViewMode;
  page: number;

  setFilter: <K extends keyof AssetFilters>(key: K, value: AssetFilters[K]) => void;
  setSort: (sort: AssetSortOptions) => void;
  setViewMode: (mode: ViewMode) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

const defaultFilters: AssetFilters = {
  collection: '',
  schema: '',
  templateId: '',
  search: '',
  burned: 'exclude',
};

const defaultSort: AssetSortOptions = {
  field: 'asset_id',
  order: 'desc',
};

export const useFilterStore = create<FilterStore>((set) => ({
  filters: { ...defaultFilters },
  sort: { ...defaultSort },
  viewMode: 'grid',
  page: 1,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1, // reset to page 1 when filter changes
    })),

  setSort: (sort) => set({ sort, page: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPage: (page) => set({ page }),

  resetFilters: () =>
    set({ filters: { ...defaultFilters }, sort: { ...defaultSort }, page: 1 }),
}));
