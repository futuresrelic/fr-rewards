import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Hexagon, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-navy-700 flex items-center justify-center">
        <Hexagon size={28} className="text-white/30" />
      </div>
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-white/40">Page not found or invalid WAX account name.</p>
      </div>
      <Link href="/">
        <Button variant="outline">
          <Home size={16} />
          Back to Home
        </Button>
      </Link>
    </div>
  );
}
