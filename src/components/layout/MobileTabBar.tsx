import React from 'react';
import { LayoutDashboard, Users, CheckCircle, Wallet, ShoppingBag } from 'lucide-react';

interface MobileTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Thumb-friendly bottom navigation for phones / small tablets.
 * Hidden from `lg` upwards, where the full sidebar is always visible.
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Desk', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle },
    { id: 'ledger', label: 'Fee Record', icon: Wallet },
    { id: 'inventory', label: 'Store', icon: ShoppingBag },
  ];

  return (
    <nav
      className="lg:hidden shrink-0 border-t border-line bg-panel flex items-stretch pb-[env(safe-area-inset-bottom)] z-30"
      aria-label="Primary navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 min-h-[52px] active:bg-hover transition-colors cursor-pointer ${
              isActive ? 'text-brand' : 'text-muted'
            }`}
          >
            <Icon className={`w-5 h-5 stroke-[1.6] ${isActive ? 'text-brand' : 'text-muted'}`} />
            <span
              className={`text-[10px] leading-none truncate max-w-full px-0.5 ${
                isActive ? 'font-bold' : 'font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
