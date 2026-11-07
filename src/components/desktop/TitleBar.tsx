import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Shield } from 'lucide-react';
import { db } from '../../db/storage';
import { GymTownLogo } from '../common/GymTownLogo';

interface TitleBarProps {
  onOpenLicense?: () => void;
  onToggleMaximize?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenLicense, onToggleMaximize }) => {
  const [karachiTime, setKarachiTime] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setKarachiTime(timeStr);
      } catch {
        setKarachiTime(new Date().toLocaleTimeString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = () => {
    setToastMessage('Minimized');
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleToggleMax = () => {
    setIsMaximized(!isMaximized);
    if (onToggleMaximize) onToggleMaximize();
  };

  const handleClose = () => {
    setToastMessage('Background Active');
    setTimeout(() => setToastMessage(null), 1500);
  };

  return (
    <div className="h-8 bg-app border-b border-line flex items-center justify-between px-3 select-none text-xs text-muted z-50 shrink-0">
      {/* Left: Brand & App Tag with Logo */}
      <div className="flex items-center gap-2">
        <GymTownLogo size="xs" />
        <span className="font-condensed font-bold text-xs uppercase tracking-wider text-ink">
          The Gym Town
        </span>
        <span className="text-line-strong">/</span>
        <span className="text-muted text-[11px] font-medium hidden sm:inline">
          Hyderabad District Station
        </span>
      </div>

      {/* Center: System Clock (Asia/Karachi) */}
      <div className="hidden md:flex items-center gap-2 text-muted font-mono text-[11px] tabular-nums">
        <span className="text-[10px] uppercase text-muted">PKT</span>
        <span className="text-ink font-medium">{karachiTime}</span>
        <span className="text-line-strong">·</span>
        <span className="text-[10px] text-muted">Hyderabad (UTC+5)</span>
      </div>

      {/* Right: Operator & Window Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenLicense}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-panel border border-line text-[10px] text-ink hover:bg-raised transition-colors cursor-pointer"
          title="Click to view receptionist profile"
        >
          <Shield className="w-3 h-3 text-brand stroke-[1.5]" />
          <span className="font-medium">{db.getSettings().receptionistProfile?.name || 'Bilal Tariq'}</span>
        </button>

        {toastMessage && (
          <span className="text-[10px] font-mono text-brand bg-panel px-2 py-0.5 rounded-[4px] border border-line">
            {toastMessage}
          </span>
        )}

        {/* Caption Controls */}
        <div className="flex items-center -mr-1 ml-1">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-ink hover:bg-raised rounded-[4px] transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
          <button
            onClick={handleToggleMax}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-ink hover:bg-raised rounded-[4px] transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Maximize2 className="w-3 h-3 stroke-[1.5]" /> : <Square className="w-3 h-3 stroke-[1.5]" />}
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-ink hover:bg-bad rounded-[4px] transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
