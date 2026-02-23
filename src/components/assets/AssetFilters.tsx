'use client';

import { useFilterStore } from '@/store/filterStore';
import { useWalletCollections } from '@/hooks/useAssets';
import Button from '@/components/ui/Button';
import { Search, X, SlidersHorizontal, Grid3X3, List } from 'lucide-react';
import { SORT_OPTIONS } from '@/lib/constants';
import type { SortField, SortOrder } from '@/lib/types';

interface AssetFiltersProps {
  account: string | null;
  totalCount?: number;
}

export default function AssetFilters({ account, totalCount }: AssetFiltersProps) {
  const { filters, sort, viewMode, setFilter, setSort, setViewMode, resetFilters } =
    useFilterStore();

  const { data: collections = [] } = useWalletCollections(account);

  const hasActiveFilters =
    filters.collection || filters.schema || filters.search || filters.templateId;

  const handleSortChange = (value: string) => {
    const [field, order] = value.split(':') as [SortField, SortOrder];
    setSort({ field, order });
  };

  const currentSortValue = `${sort.field}:${sort.order}`;

  return (
    <div className="space-y-3">
      {/* Top row: Search + Sort + View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search by name..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-navy-700 border border-white/10 rounded-xl
                       text-white text-sm placeholder:text-white/30
                       focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
          />
          {filters.search && (
            <button
              onClick={() => setFilter('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Collection filter */}
        {collections.length > 0 && (
          <select
            value={filters.collection}
            onChange={(e) => setFilter('collection', e.target.value)}
            className="bg-navy-700 border border-white/10 rounded-xl px-3 py-2 text-sm
                       text-white focus:outline-none focus:border-violet-500/50
                       min-w-[150px]"
          >
            <option value="">All Collections</option>
            {collections.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-white/40" />
          <select
            value={currentSortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-navy-700 border border-white/10 rounded-xl px-3 py-2 text-sm
                       text-white focus:outline-none focus:border-violet-500/50"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-navy-700 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${
              viewMode === 'grid'
                ? 'bg-violet-600/30 text-violet-300'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-violet-600/30 text-violet-300'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <List size={16} />
          </button>
        </div>

        {/* Total count + reset */}
        <div className="flex items-center gap-2 ml-auto">
          {totalCount !== undefined && (
            <span className="text-white/40 text-sm">
              {totalCount.toLocaleString()} assets
            </span>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X size={14} />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Schema filter (shown when collection is selected) */}
      {filters.collection && (
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">Schema:</span>
          <input
            type="text"
            placeholder="Filter by schema..."
            value={filters.schema}
            onChange={(e) => setFilter('schema', e.target.value)}
            className="px-3 py-1.5 bg-navy-700 border border-white/10 rounded-lg
                       text-white text-xs placeholder:text-white/30
                       focus:outline-none focus:border-violet-500/50 w-40"
          />
          <span className="text-white/40 text-xs">Template ID:</span>
          <input
            type="text"
            placeholder="Filter by template..."
            value={filters.templateId}
            onChange={(e) => setFilter('templateId', e.target.value)}
            className="px-3 py-1.5 bg-navy-700 border border-white/10 rounded-lg
                       text-white text-xs placeholder:text-white/30
                       focus:outline-none focus:border-violet-500/50 w-36"
          />
        </div>
      )}
    </div>
  );
}
