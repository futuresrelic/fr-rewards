import { APP_NAME, ATOMICASSETS_BASE_URL } from '@/lib/constants';
import { ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-auto py-8 px-4">
      <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center
                      justify-between gap-4 text-white/30 text-sm">
        <div>{APP_NAME} — Built on WAX + AtomicAssets</div>
        <div className="flex items-center gap-4">
          <a
            href="https://wax.atomichub.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors flex items-center gap-1"
          >
            AtomicHub <ExternalLink size={11} />
          </a>
          <a
            href={`${ATOMICASSETS_BASE_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors flex items-center gap-1"
          >
            API Docs <ExternalLink size={11} />
          </a>
          <a
            href="https://waxblock.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors flex items-center gap-1"
          >
            WAXBlock <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </footer>
  );
}
