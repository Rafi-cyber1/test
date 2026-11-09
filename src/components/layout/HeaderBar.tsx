import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  UserPlus,
  Sun,
  Moon,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { db } from '../../db/storage';
import { appStorage } from '../../db/appStorage';
import { GymTownLogo } from '../common/GymTownLogo';

interface HeaderBarProps {
  currentTab: string;
  onOpenSidebar?: () => void;
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
  onOpenSidebar,
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
    <header className="h-14 bg-panel border-b border-line px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 select-none">
      {/* Left: Mobile menu + Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden -ml-1 p-2 rounded-[6px] text-muted hover:text-ink hover:bg-raised transition-colors cursor-pointer"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 stroke-[1.6]" />
        </button>

        <GymTownLogo size="sm" className="shrink-0 hidden lg:flex" />
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="font-condensed text-sm sm:text-base font-bold text-ink tracking-[0.04em] uppercase leading-none truncate">
            {currentInfo.title}
          </h1>
          <span className="hidden sm:block text-[11px] text-muted mt-1 font-medium truncate">
            {currentInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Right Controls: Search, Register Member, Theme Toggle, User Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Global Search Button */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-[6px] bg-raised border border-line text-xs text-muted hover:text-ink hover:border-line-strong transition-all duration-150 cursor-pointer"
          aria-label="Search member or action"
        >
          <Search className="w-3.5 h-3.5 text-muted stroke-[1.5]" />
          <span className="hidden md:inline text-[11px]">Search member or action...</span>
          <span className="hidden lg:inline font-mono text-[9px] bg-panel text-muted px-1.5 py-0.5 rounded-[4px] border border-line">
            Ctrl+K
          </span>
        </button>

        {/* Monthly Fee Renewal by ID Button */}
        {onOpenMonthlyRenewal && (
          <button
            onClick={onOpenMonthlyRenewal}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line hover:border-brand text-ink text-xs font-semibold transition-all duration-150 cursor-pointer"
            title="Renew Monthly Fee by Member Unique ID (the-gym-town-01)"
            aria-label="Renew monthly fee"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand stroke-[1.5]" />
            <span className="hidden xl:inline">Renew Fee</span>
          </button>
        )}

        {/* Primary Action Button: Register Member */}
        <button
          onClick={onOpenNewMember}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-semibold transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-brand focus:outline-none"
          aria-label="Register member"
        >
          <UserPlus className="w-3.5 h-3.5 stroke-[1.5]" />
          <span className="hidden md:inline">Register Member</span>
          <span className="md:hidden">New</span>
        </button>

        {/* Notifications Trigger */}
        <button
          onClick={onOpenNotificationCenter}
          className="relative p-2 rounded-[6px] text-muted hover:text-ink hover:bg-raised transition-colors cursor-pointer"
          title="Notifications & Expiry Alerts"
        >
          <Bell className="w-4 h-4 stroke-[1.5]" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
          )}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-[6px] text-muted hover:text-ink hover:bg-raised transition-colors cursor-pointer"
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
          className="hidden sm:flex w-8 h-8 rounded-full bg-raised border border-line items-center justify-center text-ink font-condensed font-bold text-xs tracking-wider cursor-default select-none"
          title={`Reception Officer: ${receptionistName}`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};
