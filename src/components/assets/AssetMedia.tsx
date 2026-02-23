'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetMediaProps {
  url: string;
  type: 'image' | 'video' | 'none';
  name: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
}

export default function AssetMedia({
  url,
  type,
  name,
  className,
  fill = false,
  priority = false,
}: AssetMediaProps) {
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Fallback placeholder
  if (!url || error) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-navy-600', className)}>
        <ImageOff size={32} className="text-white/20" />
        <span className="text-white/20 text-xs mt-2 text-center px-2 truncate max-w-full">
          {name}
        </span>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className={cn('relative', className)}>
        {!playing ? (
          <div
            className="relative w-full h-full cursor-pointer group"
            onClick={() => setPlaying(true)}
          >
            {/* Video thumbnail (try loading video poster) */}
            <video
              src={url}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center
                            bg-black/40 group-hover:bg-black/20 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm
                              flex items-center justify-center
                              group-hover:bg-violet-500/60 transition-colors">
                <Play size={20} className="text-white ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <video
            src={url}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            controls
            onError={() => setError(true)}
          />
        )}
      </div>
    );
  }

  // Image
  if (fill) {
    return (
      <Image
        src={url}
        alt={name}
        fill
        className={cn('object-cover', className)}
        onError={() => setError(true)}
        priority={priority}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={url}
      alt={name}
      width={400}
      height={400}
      className={cn('object-cover w-full h-full', className)}
      onError={() => setError(true)}
      priority={priority}
      unoptimized
    />
  );
}
