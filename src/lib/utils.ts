import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IPFS_GATEWAYS } from './constants';

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// IPFS / Media utilities
// ============================================

/**
 * Convert an IPFS hash or URL to a full gateway URL.
 * Handles: QmXxx..., ipfs://QmXxx, https://ipfs.io/ipfs/QmXxx
 */
export function resolveIpfsUrl(value: string | undefined | null, gatewayIndex = 0): string {
  if (!value) return '';

  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];

  // Already a full http URL
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  // ipfs:// protocol
  if (value.startsWith('ipfs://')) {
    const hash = value.replace('ipfs://', '');
    return `${gateway}/${hash}`;
  }

  // Raw IPFS hash (CIDv0: Qm..., CIDv1: bafy...)
  if (value.startsWith('Qm') || value.startsWith('bafy') || value.length === 46) {
    return `${gateway}/${value}`;
  }

  // Could be a direct URL in data field
  return value;
}

/**
 * Get the media URL from an asset's data object.
 * AtomicAssets stores media in various field names.
 */
export function getAssetMedia(data: Record<string, unknown>): {
  type: 'image' | 'video' | 'none';
  url: string;
  thumbnail: string;
} {
  const imageFields = ['img', 'image', 'thumbnail', 'thumb', 'preview', 'icon'];
  const videoFields = ['video', 'video_loop', 'vid'];

  // Check video first
  for (const field of videoFields) {
    const val = data[field];
    if (val && typeof val === 'string' && val.trim()) {
      const url = resolveIpfsUrl(val);
      return { type: 'video', url, thumbnail: url };
    }
  }

  // Then image
  for (const field of imageFields) {
    const val = data[field];
    if (val && typeof val === 'string' && val.trim()) {
      const url = resolveIpfsUrl(val);
      return { type: 'image', url, thumbnail: url };
    }
  }

  return { type: 'none', url: '', thumbnail: '' };
}

/**
 * Get rarity from data attributes (common pattern in WAX NFTs)
 */
export function getAssetRarity(data: Record<string, unknown>): string {
  const rarityFields = ['rarity', 'Rarity', 'RARITY', 'tier', 'Tier', 'grade', 'Grade'];
  for (const field of rarityFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field] as string;
    }
  }
  return '';
}

// ============================================
// Rarity color mapping
// ============================================

export const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400 border-gray-600',
  uncommon: 'text-green-400 border-green-600',
  rare: 'text-blue-400 border-blue-600',
  epic: 'text-purple-400 border-purple-600',
  legendary: 'text-yellow-400 border-yellow-600',
  mythic: 'text-red-400 border-red-600',
  promo: 'text-pink-400 border-pink-600',
};

export function getRarityColor(rarity: string): string {
  const key = rarity.toLowerCase();
  return RARITY_COLORS[key] || 'text-gray-400 border-gray-600';
}

// ============================================
// Number / Date formatting
// ============================================

export function formatMintNumber(mint: string | number): string {
  const n = Number(mint);
  if (isNaN(n)) return '?';
  return `#${n.toLocaleString()}`;
}

export function formatDate(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  if (!ts || isNaN(ts)) return 'Unknown';
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  if (!ts || isNaN(ts)) return 'Unknown';
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  if (!ts || isNaN(ts)) return 'Unknown';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// WAX account validation
// ============================================

export function isValidWaxAccount(account: string): boolean {
  // WAX account names: 1-12 chars, a-z, 1-5, dots (not at end)
  return /^[a-z1-5.]{1,12}$/.test(account) && !account.endsWith('.');
}

// ============================================
// Debug logger
// ============================================

type LogLevel = 'info' | 'warn' | 'error' | 'success';

export function debugLog(level: LogLevel, message: string, details?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[OK]',
  }[level];

  if (level === 'error') {
    console.error(`${prefix} ${timestamp} - ${message}`, details || '');
  } else if (level === 'warn') {
    console.warn(`${prefix} ${timestamp} - ${message}`, details || '');
  } else {
    console.log(`${prefix} ${timestamp} - ${message}`, details || '');
  }
}
