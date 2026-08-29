'use client';

import React from 'react';
import { PageTemplate } from '@/types';
import { cn } from '@/lib/utils';

interface PageBackgroundProps {
  template: PageTemplate;
  className?: string;
}

export const PageBackground: React.FC<PageBackgroundProps> = ({
  template,
  className,
}) => {
  const getPatternClass = (tmpl: PageTemplate) => {
    switch (tmpl) {
      case 'ruled':
        return 'paper-ruled';
      case 'grid':
        return 'paper-grid';
      case 'dotted':
        return 'paper-dotted';
      case 'cornell':
        return 'paper-cornell';
      case 'blueprint':
        return 'paper-blueprint';
      case 'blank':
      default:
        return 'paper-blank';
    }
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 pointer-events-none rounded-3xl z-0 overflow-hidden',
        getPatternClass(template),
        className
      )}
    >
      {template === 'cornell' && (
        <>
          <div className="absolute top-3 left-4 text-[10px] font-mono text-app-accent/60 uppercase tracking-wider select-none">
            Cues / Questions
          </div>
          <div className="absolute top-3 left-[200px] text-[10px] font-mono text-app-text-dim uppercase tracking-wider select-none">
            Main Notes
          </div>
          <div className="absolute bottom-[140px] left-4 text-[10px] font-mono text-app-accent/60 uppercase tracking-wider select-none">
            Summary / Key Takeaways
          </div>
        </>
      )}
    </div>
  );
};
