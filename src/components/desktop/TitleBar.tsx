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
    <div className="h-8 bg-[#0D0E10] border-b border-[#262A30] flex items-center justify-between px-3 select-none text-xs text-[#8B909A] z-50 shrink-0">
      {/* Left: Brand & App Tag with Logo */}
      <div className="flex items-center gap-2">
        <GymTownLogo size="xs" />
        <span className="font-condensed font-bold text-xs uppercase tracking-wider text-[#ECEAE6]">
          The Gym Town
        </span>
        <span className="text-[#262A30]">/</span>
        <span className="text-[#8B909A] text-[11px] font-medium hidden sm:inline">
          Hyderabad District Station
        </span>
      </div>

      {/* Center: System Clock (Asia/Karachi) */}
      <div className="hidden md:flex items-center gap-2 text-[#8B909A] font-mono text-[11px] tabular-nums">
        <span className="text-[10px] uppercase text-[#8B909A]">PKT</span>
        <span className="text-[#ECEAE6] font-medium">{karachiTime}</span>
        <span className="text-[#262A30]">·</span>
        <span className="text-[10px] text-[#8B909A]">Hyderabad (UTC+5)</span>
      </div>

      {/* Right: Operator & Window Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenLicense}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#15171A] border border-[#262A30] text-[10px] text-[#ECEAE6] hover:bg-[#1C1F23] transition-colors cursor-pointer"
          title="Click to view receptionist profile"
        >
          <Shield className="w-3 h-3 text-[#D9383A] stroke-[1.5]" />
          <span className="font-medium">{db.getSettings().receptionistProfile?.name || 'Bilal Tariq'}</span>
        </button>

        {toastMessage && (
          <span className="text-[10px] font-mono text-[#D9383A] bg-[#15171A] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
            {toastMessage}
          </span>
        )}

        {/* Caption Controls */}
        <div className="flex items-center -mr-1 ml-1">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23] rounded-[4px] transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
          <button
            onClick={handleToggleMax}
            className="w-7 h-7 flex items-center justify-center text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23] rounded-[4px] transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Maximize2 className="w-3 h-3 stroke-[1.5]" /> : <Square className="w-3 h-3 stroke-[1.5]" />}
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#E5484D] rounded-[4px] transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
