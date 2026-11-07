import React from 'react';
import { db } from '../../db/storage';

interface GymTownLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  className?: string;
  variant?: 'full' | 'icon-only';
}

export const GymTownLogo: React.FC<GymTownLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const settings = db.getSettings();
  const sizeMap = {
    xs: { image: 'h-4 max-w-[40px]', text: 'text-[11px]', sub: 'text-[8px]' },
    sm: { image: 'h-7 max-w-[100px]', text: 'text-xs', sub: 'text-[9px]' },
    md: { image: 'h-9 max-w-[130px]', text: 'text-sm', sub: 'text-[10px]' },
    lg: { image: 'h-12 max-w-[160px]', text: 'text-base', sub: 'text-xs' },
    xl: { image: 'h-16 max-w-[210px]', text: 'text-lg', sub: 'text-xs' },
    '2xl': { image: 'h-24 max-w-[300px]', text: 'text-2xl', sub: 'text-sm' },
  };
  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      {/* Original brand mark: transparent version on the dark UI and the same
          artwork on its black background for the light UI, where white lettering
          would otherwise disappear. */}
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt={settings.gymName || 'The Gym Town'}
        className={`${currentSize.image} logo-on-dark w-auto object-contain shrink-0`}
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
      <img
        src={`${import.meta.env.BASE_URL}logo-receipt.png`}
        alt={settings.gymName || 'The Gym Town'}
        className={`${currentSize.image} logo-on-light w-auto object-contain rounded-[3px] shrink-0`}
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
      {showText && (
        <div className="flex flex-col min-w-0">
          <span className={`font-display font-extrabold text-ink tracking-wider uppercase truncate ${currentSize.text}`}>
            {settings.gymName || 'THE GYM TOWN'}
          </span>
          <span className={`text-brand font-semibold truncate ${currentSize.sub}`}>
            {settings.city?.includes('Hyderabad') ? 'Hyderabad Station' : 'Strength & Fitness'}
          </span>
        </div>
      )}
    </div>
  );
};
