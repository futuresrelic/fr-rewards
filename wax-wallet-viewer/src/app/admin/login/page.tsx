'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Lock, AlertCircle, Hexagon } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.success) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
            <Hexagon size={18} className="text-white" fill="white" />
          </div>
          <span className="text-white font-bold text-xl">Admin Panel</span>
        </div>

        <div className="bg-navy-700 border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
              <Lock size={22} className="text-violet-400" />
            </div>
            <h1 className="text-white font-semibold text-lg">Admin Access</h1>
            <p className="text-white/40 text-sm mt-1">Enter your admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full px-4 py-3 bg-navy-800 border border-white/10 rounded-xl
                           text-white placeholder:text-white/20
                           focus:outline-none focus:border-violet-500/50 focus:ring-1
                           focus:ring-violet-500/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              <Lock size={16} />
              Sign In
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-white/20 text-xs">
              Password is set via <code className="bg-white/5 px-1 rounded">ADMIN_PASSWORD</code> environment variable
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
