// ============================================
// AtomicAssets API Client
// Docs: https://wax.api.atomicassets.io/docs
// ============================================

import axios, { type AxiosInstance } from 'axios';
import { ATOMICASSETS_BASE_URL, ASSETS_PER_PAGE } from './constants';
import type {
  AtomicAsset,
  AtomicCollection,
  AtomicTemplate,
  AssetFilters,
  AssetSortOptions,
} from './types';
import { debugLog } from './utils';

// Singleton axios instance
let client: AxiosInstance;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: ATOMICASSETS_BASE_URL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      },
    });

    // Request interceptor for debugging
    client.interceptors.request.use((config) => {
      debugLog('info', `AtomicAssets API: ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
      });
      return config;
    });

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url;
        debugLog('error', `AtomicAssets API error: ${status} on ${url}`, error.message);
        return Promise.reject(error);
      }
    );
  }
  return client;
}

// ============================================
// Assets
// ============================================

export interface FetchAssetsParams {
  owner: string;
  page?: number;
  limit?: number;
  filters?: Partial<AssetFilters>;
  sort?: AssetSortOptions;
}

export async function fetchAssets(params: FetchAssetsParams): Promise<{
  assets: AtomicAsset[];
  total: number;
}> {
  const {
    owner,
    page = 1,
    limit = ASSETS_PER_PAGE,
    filters = {},
    sort = { field: 'asset_id', order: 'desc' },
  } = params;

  const queryParams: Record<string, string | number> = {
    owner,
    page,
    limit,
    order: sort.order,
    sort: sort.field,
  };

  if (filters.collection) queryParams.collection_name = filters.collection;
  if (filters.schema) queryParams.schema_name = filters.schema;
  if (filters.templateId) queryParams.template_id = filters.templateId;
  if (filters.search) queryParams.match = filters.search;

  // Handle burned filter
  if (filters.burned === 'only') {
    queryParams.burned = '1';
  } else if (filters.burned === 'exclude') {
    queryParams.burned = '0';
  }
  // 'include' = don't add param (default shows unburned)

  const response = await getClient().get('/atomicassets/v1/assets', {
    params: queryParams,
  });

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch assets');
  }

  return {
    assets: response.data.data as AtomicAsset[],
    total: response.data.query_time,
  };
}

export async function fetchAssetById(assetId: string): Promise<AtomicAsset> {
  const response = await getClient().get(`/atomicassets/v1/assets/${assetId}`);
  if (!response.data.success) {
    throw new Error(response.data.message || 'Asset not found');
  }
  return response.data.data as AtomicAsset;
}

// ============================================
// Collections owned by a wallet
// ============================================

export async function fetchCollectionsByOwner(owner: string): Promise<string[]> {
  try {
    // Fetch distinct collections for this owner by getting all assets (up to first 1000)
    // and extracting unique collection names
    const response = await getClient().get('/atomicassets/v1/assets', {
      params: {
        owner,
        limit: 1000,
        page: 1,
        sort: 'collection_name',
        order: 'asc',
      },
    });
    if (!response.data.success) return [];
    const assets: AtomicAsset[] = response.data.data;
    const collections = [...new Set(assets.map((a) => a.collection.collection_name))];
    return collections.sort();
  } catch {
    return [];
  }
}

// ============================================
// Collections info
// ============================================

export async function fetchCollection(collectionName: string): Promise<AtomicCollection | null> {
  try {
    const response = await getClient().get(
      `/atomicassets/v1/collections/${collectionName}`
    );
    if (!response.data.success) return null;
    return response.data.data as AtomicCollection;
  } catch {
    return null;
  }
}

// ============================================
// Schemas for a collection
// ============================================

export async function fetchSchemasByCollection(collectionName: string): Promise<string[]> {
  try {
    const response = await getClient().get('/atomicassets/v1/schemas', {
      params: {
        collection_name: collectionName,
        limit: 100,
      },
    });
    if (!response.data.success) return [];
    return response.data.data.map(
      (s: { schema_name: string }) => s.schema_name
    );
  } catch {
    return [];
  }
}

// ============================================
// Templates
// ============================================

export async function fetchTemplate(
  collectionName: string,
  templateId: string
): Promise<AtomicTemplate | null> {
  try {
    const response = await getClient().get(
      `/atomicassets/v1/templates/${collectionName}/${templateId}`
    );
    if (!response.data.success) return null;
    return response.data.data as AtomicTemplate;
  } catch {
    return null;
  }
}

// ============================================
// Account stats
// ============================================

export async function fetchAccountStats(account: string): Promise<{
  assets: number;
  collections: number;
  schemas: number;
  templates: number;
}> {
  try {
    const response = await getClient().get(`/atomicassets/v1/accounts/${account}`);
    if (!response.data.success) {
      return { assets: 0, collections: 0, schemas: 0, templates: 0 };
    }
    const data = response.data.data;
    return {
      assets: data.assets ?? 0,
      collections: (data.collections ?? []).length,
      schemas: (data.schemas ?? []).length,
      templates: (data.templates ?? []).length,
    };
  } catch {
    return { assets: 0, collections: 0, schemas: 0, templates: 0 };
  }
}

// ============================================
// Server-side: fetch with base URL override (for API routes)
// ============================================

export async function serverFetchAssets(params: FetchAssetsParams) {
  // Use server-side env var for API URL
  const baseUrl = process.env.ATOMICASSETS_API || ATOMICASSETS_BASE_URL;
  const {
    owner,
    page = 1,
    limit = ASSETS_PER_PAGE,
    filters = {},
    sort = { field: 'asset_id', order: 'desc' },
  } = params;

  const queryParams = new URLSearchParams({
    owner,
    page: String(page),
    limit: String(limit),
    order: sort.order,
    sort: sort.field,
  });

  if (filters.collection) queryParams.set('collection_name', filters.collection);
  if (filters.schema) queryParams.set('schema_name', filters.schema);
  if (filters.templateId) queryParams.set('template_id', filters.templateId);
  if (filters.search) queryParams.set('match', filters.search);
  if (filters.burned === 'only') queryParams.set('burned', '1');
  else if (filters.burned === 'exclude') queryParams.set('burned', '0');

  const url = `${baseUrl}/atomicassets/v1/assets?${queryParams}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  const json = await res.json();
  return json;
}
