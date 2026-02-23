// ============================================
// WAX / AtomicAssets Types
// ============================================

export interface AtomicAsset {
  asset_id: string;
  contract: string;
  owner: string;
  name: string;
  is_transferable: boolean;
  is_burnable: boolean;
  template_mint: string;
  collection: {
    collection_name: string;
    name: string;
    img: string;
    author: string;
    allow_notify: boolean;
    authorized_accounts: string[];
    notify_accounts: string[];
    market_fee: number;
    created_at_block: string;
    created_at_time: string;
  };
  schema: {
    schema_name: string;
    format: SchemaFormat[];
    created_at_block: string;
    created_at_time: string;
  };
  template: {
    template_id: string;
    max_supply: string;
    issued_supply: string;
    is_transferable: boolean;
    is_burnable: boolean;
    immutable_data: Record<string, unknown>;
    created_at_block: string;
    created_at_time: string;
  } | null;
  backed_tokens: BackedToken[];
  immutable_data: Record<string, unknown>;
  mutable_data: Record<string, unknown>;
  data: Record<string, unknown>;
  burned_by_account: string | null;
  burned_at_block: string | null;
  burned_at_time: string | null;
  updated_at_block: string;
  updated_at_time: string;
  transferred_at_block: string;
  transferred_at_time: string;
  minted_at_block: string;
  minted_at_time: string;
}

export interface SchemaFormat {
  name: string;
  type: string;
}

export interface BackedToken {
  token_contract: string;
  token_symbol: string;
  token_precision: number;
  amount: string;
}

export interface AtomicCollection {
  collection_name: string;
  name: string;
  img: string;
  author: string;
  allow_notify: boolean;
  authorized_accounts: string[];
  notify_accounts: string[];
  market_fee: number;
  data: Record<string, unknown>;
  created_at_block: string;
  created_at_time: string;
}

export interface AtomicTemplate {
  template_id: string;
  max_supply: string;
  issued_supply: string;
  is_transferable: boolean;
  is_burnable: boolean;
  immutable_data: Record<string, unknown>;
  created_at_block: string;
  created_at_time: string;
  collection: AtomicCollection;
  schema: {
    schema_name: string;
    format: SchemaFormat[];
  };
}

export interface AssetsApiResponse {
  success: boolean;
  data: AtomicAsset[];
  query_time: number;
}

// ============================================
// Wallet Types
// ============================================

export type WalletType = 'wax-cloud-wallet' | 'anchor' | null;

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  walletType: WalletType;
  isConnecting: boolean;
  error: string | null;
}

// ============================================
// Filter / Sort Types
// ============================================

export type SortField = 'asset_id' | 'template_mint' | 'name' | 'transferred_at_time' | 'minted_at_time';
export type SortOrder = 'asc' | 'desc';

export interface AssetFilters {
  collection: string;
  schema: string;
  templateId: string;
  search: string;
  burned: 'include' | 'exclude' | 'only';
}

export interface AssetSortOptions {
  field: SortField;
  order: SortOrder;
}

export type ViewMode = 'grid' | 'list';

// ============================================
// Admin Types
// ============================================

export interface AdminSettings {
  featuredCollections: string[];
  atomicAssetsApi: string;
  ipfsGateways: string[];
  maintenanceMode: boolean;
  customBrandName: string;
  announcementBanner: string;
}

export interface DebugEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: unknown;
}
