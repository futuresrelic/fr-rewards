import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_please_set_JWT_SECRET_in_env'
);

async function isAdminRequest(req: NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_token')?.value;
    if (!token) return false;
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// GET /api/debug — returns system info (admin only)
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const info = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    config: {
      ATOMICASSETS_API: process.env.NEXT_PUBLIC_ATOMICASSETS_API || 'https://wax.api.atomicassets.io',
      WAX_RPC: process.env.NEXT_PUBLIC_WAX_RPC || 'https://wax.greymass.com',
      IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://atomichub-ipfs.com/ipfs',
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
    },
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    nodeVersion: process.version,
  };

  return NextResponse.json(info);
}

// POST /api/debug/ping — ping AtomicAssets API
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const account = (body.account as string) || 'eosio';
  const apiBase = process.env.NEXT_PUBLIC_ATOMICASSETS_API || 'https://wax.api.atomicassets.io';

  const results: Record<string, unknown> = {};

  // Test AtomicAssets API
  try {
    const start = Date.now();
    const res = await fetch(`${apiBase}/atomicassets/v1/assets?owner=${account}&limit=1`);
    const data = await res.json();
    results.atomicassets = {
      status: res.status,
      ok: data.success,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    results.atomicassets = { error: String(err) };
  }

  // Test WAX RPC
  const rpcUrl = process.env.NEXT_PUBLIC_WAX_RPC || 'https://wax.greymass.com';
  try {
    const start = Date.now();
    const res = await fetch(`${rpcUrl}/v1/chain/get_info`);
    const data = await res.json();
    results.waxRpc = {
      status: res.status,
      chainId: data.chain_id?.substring(0, 8) + '...',
      headBlock: data.head_block_num,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    results.waxRpc = { error: String(err) };
  }

  return NextResponse.json({ success: true, results });
}
