'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  Settings, LogOut, Activity, Zap, Database, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Terminal, Server, Globe
} from 'lucide-react';

interface DebugResult {
  atomicassets?: { status: number; ok: boolean; latencyMs: number; error?: string };
  waxRpc?: { status: number; chainId: string; headBlock: number; latencyMs: number; error?: string };
}

interface SystemInfo {
  timestamp: string;
  environment: string;
  config: Record<string, string | boolean>;
  uptime: number;
  memoryMB: number;
  nodeVersion: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResults, setPingResults] = useState<DebugResult | null>(null);
  const [pingAccount, setPingAccount] = useState('eosio');
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [sysLoading, setSysLoading] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const handlePing = async () => {
    setPingLoading(true);
    setPingResults(null);
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: pingAccount }),
      });
      const data = await res.json();
      if (data.success) {
        setPingResults(data.results);
      }
    } catch (err) {
      console.error('Ping failed:', err);
    } finally {
      setPingLoading(false);
    }
  };

  const fetchSysInfo = async () => {
    setSysLoading(true);
    try {
      const res = await fetch('/api/debug');
      const data = await res.json();
      setSysInfo(data);
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    } finally {
      setSysLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-white/40 text-sm">WAX Wallet Viewer — System Administration</p>
        </div>
        <Button onClick={handleLogout} variant="outline" size="sm">
          <LogOut size={15} />
          Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Health Check */}
        <div className="bg-navy-700/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-green-400" />
            <h2 className="text-white font-semibold">API Health Check</h2>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={pingAccount}
              onChange={(e) => setPingAccount(e.target.value)}
              placeholder="WAX account to test..."
              className="flex-1 px-3 py-2 bg-navy-800 border border-white/10 rounded-xl
                         text-white text-sm placeholder:text-white/30
                         focus:outline-none focus:border-violet-500/50"
            />
            <Button onClick={handlePing} loading={pingLoading} size="sm">
              <Zap size={14} />
              Test
            </Button>
          </div>

          {pingResults && (
            <div className="space-y-3">
              {/* AtomicAssets */}
              <ApiResultRow
                name="AtomicAssets API"
                result={pingResults.atomicassets}
              />
              {/* WAX RPC */}
              {pingResults.waxRpc && (
                <ApiResultRow
                  name="WAX RPC"
                  result={pingResults.waxRpc}
                  extra={
                    'headBlock' in (pingResults.waxRpc || {})
                      ? `Block #${(pingResults.waxRpc as { headBlock: number }).headBlock?.toLocaleString()}`
                      : undefined
                  }
                />
              )}
            </div>
          )}

          {!pingResults && !pingLoading && (
            <p className="text-white/30 text-sm text-center py-4">
              Click &quot;Test&quot; to ping all services
            </p>
          )}
        </div>

        {/* System Info */}
        <div className="bg-navy-700/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-blue-400" />
              <h2 className="text-white font-semibold">System Info</h2>
            </div>
            <Button onClick={fetchSysInfo} loading={sysLoading} variant="outline" size="sm">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>

          {sysInfo ? (
            <div className="space-y-2">
              <InfoRow label="Environment" value={sysInfo.environment} />
              <InfoRow label="Node Version" value={sysInfo.nodeVersion} />
              <InfoRow label="Memory" value={`${sysInfo.memoryMB} MB`} />
              <InfoRow label="Uptime" value={formatUptime(sysInfo.uptime)} />
              <InfoRow
                label="Admin Password"
                value={sysInfo.config.ADMIN_PASSWORD_SET ? 'Configured' : 'NOT SET ⚠️'}
                valueClass={sysInfo.config.ADMIN_PASSWORD_SET ? 'text-green-400' : 'text-red-400'}
              />
              <InfoRow
                label="JWT Secret"
                value={sysInfo.config.JWT_SECRET_SET ? 'Configured' : 'Using fallback ⚠️'}
                valueClass={sysInfo.config.JWT_SECRET_SET ? 'text-green-400' : 'text-yellow-400'}
              />
              <div className="pt-2 border-t border-white/5">
                <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Endpoints</div>
                <InfoRow label="AtomicAssets" value={String(sysInfo.config.ATOMICASSETS_API)} small />
                <InfoRow label="WAX RPC" value={String(sysInfo.config.WAX_RPC)} small />
                <InfoRow label="IPFS Gateway" value={String(sysInfo.config.IPFS_GATEWAY)} small />
              </div>
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-4">
              Click &quot;Refresh&quot; to load system info
            </p>
          )}
        </div>

        {/* Configuration Guide */}
        <div className="lg:col-span-2 bg-navy-700/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={18} className="text-violet-400" />
            <h2 className="text-white font-semibold">Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigSection
              title="Required Env Variables"
              icon={<Terminal size={15} className="text-red-400" />}
              items={[
                { key: 'ADMIN_PASSWORD', desc: 'Admin panel password' },
                { key: 'JWT_SECRET', desc: 'Min 32 chars random string' },
              ]}
              variant="required"
            />
            <ConfigSection
              title="Optional Env Variables"
              icon={<Globe size={15} className="text-green-400" />}
              items={[
                { key: 'NEXT_PUBLIC_APP_URL', desc: 'Your app URL (for WCW callback)' },
                { key: 'NEXT_PUBLIC_APP_NAME', desc: 'App name shown in wallet dialogs' },
                { key: 'NEXT_PUBLIC_WAX_RPC', desc: 'WAX RPC endpoint' },
                { key: 'NEXT_PUBLIC_ATOMICASSETS_API', desc: 'AtomicAssets API URL' },
                { key: 'NEXT_PUBLIC_IPFS_GATEWAY', desc: 'IPFS gateway for media' },
              ]}
              variant="optional"
            />
          </div>

          <div className="mt-4 p-4 rounded-xl bg-navy-800 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Database size={14} className="text-cyan-400" />
              <span className="text-white/60 text-sm font-medium">WAX Cloud Wallet Note</span>
            </div>
            <p className="text-white/40 text-sm">
              WAX Cloud Wallet (WCW) requires your app URL to be set in{' '}
              <code className="bg-white/5 px-1 rounded text-xs">NEXT_PUBLIC_APP_URL</code>.
              For Railway: set it to your Railway deployment URL (e.g.{' '}
              <code className="bg-white/5 px-1 rounded text-xs">https://your-app.up.railway.app</code>).
              On localhost, WCW should work at <code className="bg-white/5 px-1 rounded text-xs">http://localhost:3000</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Helper components ----

function ApiResultRow({
  name,
  result,
  extra,
}: {
  name: string;
  result?: { status?: number; ok?: boolean; latencyMs?: number; error?: string } | undefined;
  extra?: string;
}) {
  if (!result) return null;

  const ok = result.ok ?? (result.status && result.status < 300);
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-navy-800/60 border border-white/5">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle size={15} className="text-green-400" />
        ) : (
          <XCircle size={15} className="text-red-400" />
        )}
        <span className="text-white/70 text-sm">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {extra && <span className="text-white/30 text-xs">{extra}</span>}
        {result.latencyMs && (
          <Badge variant={result.latencyMs < 500 ? 'green' : result.latencyMs < 1000 ? 'yellow' : 'red'}>
            {result.latencyMs}ms
          </Badge>
        )}
        {result.error && (
          <Badge variant="red">
            <AlertCircle size={10} className="mr-1" />
            Error
          </Badge>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
  small,
}: {
  label: string;
  value: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1 ${small ? '' : ''}`}>
      <span className="text-white/40 text-sm">{label}</span>
      <span className={`text-sm font-medium truncate max-w-[60%] text-right ${valueClass || 'text-white/80'}`}>
        {value}
      </span>
    </div>
  );
}

function ConfigSection({
  title,
  icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ReactNode;
  items: { key: string; desc: string }[];
  variant: 'required' | 'optional';
}) {
  return (
    <div className="p-4 rounded-xl bg-navy-800/60 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-white/70 text-sm font-medium">{title}</span>
      </div>
      <div className="space-y-2">
        {items.map(({ key, desc }) => (
          <div key={key} className="flex items-start gap-2">
            <Badge variant={variant === 'required' ? 'red' : 'gray'} className="mt-0.5 flex-shrink-0">
              {variant === 'required' ? 'req' : 'opt'}
            </Badge>
            <div>
              <code className="text-xs text-violet-300">{key}</code>
              <div className="text-white/30 text-xs">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
