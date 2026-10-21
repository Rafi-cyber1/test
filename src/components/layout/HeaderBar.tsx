import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  UserPlus,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { db } from '../../db/storage';
import { appStorage } from '../../db/appStorage';
import { GymTownLogo } from '../common/GymTownLogo';

interface HeaderBarProps {
  currentTab: string;
  onOpenCommandPalette: () => void;
  onOpenNotificationCenter: () => void;
  unreadNotifications: number;
  onOpenNewMember: () => void;
  onOpenQuickPayment: () => void;
  onNavigate: (tab: string) => void;
  onOpenMonthlyRenewal?: () => void;
  onOpenSuperAdmin?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentTab,
  onOpenCommandPalette,
  onOpenNotificationCenter,
  unreadNotifications,
  onOpenNewMember,
  onOpenMonthlyRenewal,
}) => {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const savedTheme = appStorage.getItem('tgt_theme');
    if (savedTheme === 'light') {
      setIsLightMode(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    if (isLightMode) {
      document.documentElement.classList.remove('light');
      appStorage.setItem('tgt_theme', 'dark');
      setIsLightMode(false);
    } else {
      document.documentElement.classList.add('light');
      appStorage.setItem('tgt_theme', 'light');
      setIsLightMode(true);
    }
  };

  const pageTitleMap: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'FRONT DESK DASHBOARD', subtitle: 'Hyderabad District Desk' },
    members: { title: 'MEMBER DIRECTORY', subtitle: 'Registration & Active Members' },
    blood: { title: 'BLOOD GROUP DIRECTORY', subtitle: 'Member Blood Groups & Contact Actions' },
    inventory: { title: 'STORE & POINT OF SALE (POS)', subtitle: 'Stock Catalog & Daily Sales' },
    plans: { title: 'MEMBERSHIP PLANS & RATES', subtitle: 'Fee Structure & Packages' },
    attendance: { title: 'MANUAL ATTENDANCE REGISTER', subtitle: 'Daily Check-in & Logs' },
    ledger: { title: 'MEMBER FEE RECORD', subtitle: 'Complete Member Payment History & Receipts' },
    settings: { title: 'STATION & SYSTEM SETTINGS', subtitle: 'Desk Profile & Data Backup' },
  };

  const currentInfo = pageTitleMap[currentTab] || {
    title: 'FRONT DESK DASHBOARD',
    subtitle: 'Hyderabad District',
  };

  const receptionistName = db.getSettings().receptionistProfile?.name || 'Bilal Tariq';
  const initials = receptionistName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 bg-[#15171A] border-b border-[#262A30] px-5 flex items-center justify-between shrink-0 select-none">
      {/* Left: Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <GymTownLogo size="sm" className="shrink-0" />
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="font-condensed text-base font-bold text-[#ECEAE6] tracking-[0.04em] uppercase leading-none truncate">
            {currentInfo.title}
          </h1>
          <span className="text-[11px] text-[#8B909A] mt-1 font-medium truncate">
            {currentInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Right Controls: Search, Register Member, Theme Toggle, User Avatar */}
      <div className="flex items-center gap-2.5">
        {/* Global Search Button */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#1C1F23] border border-[#262A30] text-xs text-[#8B909A] hover:text-[#ECEAE6] hover:border-[#363B44] transition-all duration-150 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-[#8B909A] stroke-[1.5]" />
          <span className="hidden md:inline text-[11px]">Search member or action...</span>
          <span className="font-mono text-[9px] bg-[#15171A] text-[#8B909A] px-1.5 py-0.5 rounded-[4px] border border-[#262A30]">
            Ctrl+K
          </span>
        </button>

        {/* Monthly Fee Renewal by ID Button */}
        {onOpenMonthlyRenewal && (
          <button
            onClick={onOpenMonthlyRenewal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] hover:border-[#D9383A] text-[#ECEAE6] text-xs font-semibold transition-all duration-150 cursor-pointer"
            title="Renew Monthly Fee by Member Unique ID (the-gym-town-01)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#D9383A] stroke-[1.5]" />
            <span className="hidden sm:inline">Renew Fee</span>
          </button>
        )}

        {/* Primary Action Button: Register Member */}
        <button
          onClick={onOpenNewMember}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-semibold transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
        >
          <UserPlus className="w-3.5 h-3.5 stroke-[1.5]" />
          <span>Register Member</span>
        </button>

        {/* Notifications Trigger */}
        <button
          onClick={onOpenNotificationCenter}
          className="relative p-2 rounded-[6px] text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23] transition-colors cursor-pointer"
          title="Notifications & Expiry Alerts"
        >
          <Bell className="w-4 h-4 stroke-[1.5]" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D9383A]" />
          )}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-[6px] text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23] transition-colors cursor-pointer"
          title={isLightMode ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
        >
          {isLightMode ? (
            <Moon className="w-4 h-4 stroke-[1.5]" />
          ) : (
            <Sun className="w-4 h-4 stroke-[1.5]" />
          )}
        </button>

        {/* User Avatar with Initials */}
        <div
          className="w-8 h-8 rounded-full bg-[#1C1F23] border border-[#262A30] flex items-center justify-center text-[#ECEAE6] font-condensed font-bold text-xs tracking-wider cursor-default select-none"
          title={`Reception Officer: ${receptionistName}`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};
