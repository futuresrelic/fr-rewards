'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import WalletButton from '@/components/wallet/WalletButton';
import { APP_NAME } from '@/lib/constants';
import { Search, Menu, X, Hexagon, Settings } from 'lucide-react';
import { isValidWaxAccount } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const account = searchQuery.trim().toLowerCase();
    if (account && isValidWaxAccount(account)) {
      router.push(`/wallet/${account}`);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/my-wallet', label: 'My Wallet' },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-navy-800/80 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center">
            <Hexagon size={16} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-lg hidden sm:block">{APP_NAME}</span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                pathname === link.href
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex-1 max-w-sm mx-auto hidden md:flex"
        >
          <div className="relative w-full">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              type="text"
              placeholder="Search wallet address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-navy-700 border border-white/10 rounded-xl
                         text-white text-sm placeholder:text-white/30
                         focus:outline-none focus:border-violet-500/50 focus:ring-1
                         focus:ring-violet-500/20"
            />
          </div>
        </form>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden md:flex p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            title="Admin Panel"
          >
            <Settings size={18} />
          </Link>
          <WalletButton />

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/5 text-white/70"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-navy-800 px-4 pb-4 space-y-3">
          <form onSubmit={handleSearch} className="pt-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search wallet address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-navy-700 border border-white/10 rounded-xl
                           text-white text-sm placeholder:text-white/30 focus:outline-none
                           focus:border-violet-500/50"
              />
            </div>
          </form>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-white/60 hover:text-white text-sm"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="block py-2 text-white/60 hover:text-white text-sm"
            onClick={() => setMenuOpen(false)}
          >
            Admin
          </Link>
        </div>
      )}
    </nav>
  );
}
