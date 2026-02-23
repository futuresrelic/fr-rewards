// ============================================
// WAX Wallet Viewer - Constants
// ============================================

export const WAX_CHAIN_ID =
  process.env.NEXT_PUBLIC_WAX_CHAIN_ID ||
  '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

export const WAX_RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_WAX_RPC || 'https://wax.greymass.com',
  'https://wax.eosusa.io',
  'https://api.waxsweden.org',
  'https://wax.cryptolions.io',
];

export const ATOMICASSETS_BASE_URL =
  process.env.NEXT_PUBLIC_ATOMICASSETS_API || 'https://wax.api.atomicassets.io';

export const IPFS_GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://atomichub-ipfs.com/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://ipfs.io/ipfs',
  'https://gateway.pinata.cloud/ipfs',
  'https://nftstorage.link/ipfs',
];

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || 'WAX Wallet Viewer';

export const ASSETS_PER_PAGE = 50;

export const SORT_OPTIONS = [
  { value: 'asset_id:desc', label: 'Newest First' },
  { value: 'asset_id:asc', label: 'Oldest First' },
  { value: 'template_mint:asc', label: 'Mint # (Low → High)' },
  { value: 'template_mint:desc', label: 'Mint # (High → Low)' },
  { value: 'name:asc', label: 'Name (A → Z)' },
  { value: 'name:desc', label: 'Name (Z → A)' },
  { value: 'transferred_at_time:desc', label: 'Recently Transferred' },
  { value: 'minted_at_time:desc', label: 'Recently Minted' },
] as const;

export const WAX_EXPLORER_URL = 'https://waxblock.io';
export const ATOMICHUB_URL = 'https://wax.atomichub.io';
