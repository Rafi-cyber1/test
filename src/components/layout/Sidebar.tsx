import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  CheckCircle,
  Settings,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Droplet,
  Wallet,
  X,
} from 'lucide-react';
import { db } from '../../db/storage';
import { UserAccount } from '../../types';
import { GymTownLogo } from '../common/GymTownLogo';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: UserAccount;
  onOpenSuperAdmin?: () => void;
  /** Off-canvas drawer state — only used below the `lg` breakpoint. */
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  // Below `lg` the sidebar is an off-canvas drawer and always shows full labels.
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsSmallScreen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const compact = isCollapsed && !isSmallScreen;

  const members = db.getMembers();
  const lowStockCount = db.getLowStockProducts().length;

  const navGroups: { group: string; items: { id: string; label: string; icon: typeof LayoutDashboard; badge?: number; alert?: string }[] }[] = [
    {
      group: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Reception Desk', icon: LayoutDashboard },
        { id: 'members', label: 'Member Directory', icon: Users, badge: members.length },
        { id: 'blood', label: 'Blood Group Directory', icon: Droplet },
        { id: 'attendance', label: 'Manual Attendance', icon: CheckCircle },
      ],
    },
    {
      group: 'STORE & POS',
      items: [
        {
          id: 'inventory',
          label: 'Inventory & POS',
          icon: ShoppingBag,
          alert: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
        },
        { id: 'plans', label: 'Plans & Fee Rates', icon: Layers },
      ],
    },
    {
      group: 'BILLING & SYSTEM',
      items: [
        { id: 'ledger', label: 'Member Fee Record', icon: Wallet },
        { id: 'settings', label: 'Station Settings', icon: Settings },
      ],
    },
  ];

  const receptionistName = db.getSettings().receptionistProfile?.name || currentUser?.fullName || 'Bilal Tariq';
  const receptionistShift = db.getSettings().receptionistProfile?.shift || 'Morning Shift';

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity duration-200 ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`bg-panel border-r border-line flex flex-col justify-between select-none shrink-0 h-full
          fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-200 ease-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-auto lg:translate-x-0 lg:transition-all lg:duration-150
          ${compact ? 'lg:w-16' : 'lg:w-[232px]'}`}
      >
      <div className="flex-1 overflow-y-auto">
        {/* Logo Section: Top-left, height 32-36px, with 20px padding */}
        <div className={`${compact ? 'p-2' : 'p-5 pb-4'} border-b border-line flex items-center justify-between`}>
          {!compact ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <GymTownLogo size="sm" showText={false} />
              <div className="flex flex-col min-w-0">
                <span className="font-condensed text-base font-bold text-ink tracking-[0.04em] uppercase truncate leading-none">
                  THE GYM TOWN
                </span>
                <span className="text-[10px] text-muted font-medium tracking-wider uppercase mt-1 truncate">
                  Hyderabad Station
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <GymTownLogo size="xs" showText={false} />
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className={`text-muted hover:text-ink p-1 rounded-[4px] hover:bg-raised transition-colors cursor-pointer ${
              compact ? 'hidden' : 'hidden lg:block'
            }`}
            title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
          </button>

          {/* Mobile close */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-muted hover:text-ink p-1.5 -mr-1 rounded-[4px] hover:bg-raised transition-colors cursor-pointer"
            title="Close menu"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 stroke-[1.8]" />
          </button>
        </div>

        {/* Expand toggle when collapsed */}
        {compact && (
          <div className="py-2 hidden lg:flex justify-center border-b border-line">
            <button
              onClick={onToggleCollapse}
              className="text-muted hover:text-ink p-1 rounded-[4px] hover:bg-raised transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="p-2 space-y-4">
          {navGroups.map((grp) => (
            <div key={grp.group} className="space-y-0.5">
              {!compact && (
                <div className="hidden lg:block px-3 py-1 text-[10px] uppercase tracking-[0.04em] text-muted font-semibold">
                  {grp.group}
                </div>
              )}

              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'border-l-2 border-brand bg-raised text-ink font-semibold'
                        : 'border-l-2 border-transparent text-muted hover:text-ink hover:bg-raised/60 font-medium'
                    }`}
                    title={compact ? item.label : undefined}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 stroke-[1.5] ${isActive ? 'text-brand' : 'currentColor'}`} />
                    {!compact && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}

                    {!compact && item.badge !== undefined && (
                      <span className="font-mono text-[10px] font-semibold text-muted bg-app px-1.5 py-0.2 rounded-full border border-line tabular-nums">
                        {item.badge}
                      </span>
                    )}

                    {!compact && item.alert !== undefined && (
                      <span className="status-pill-warning text-[10px] py-0 px-1.5 tabular-nums">
                        {item.alert}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer: Logged-in user + logout pinned at bottom */}
      <div className="p-3 border-t border-line bg-panel space-y-2 shrink-0">
        <button
          onClick={() => onTabChange('settings')}
          className="w-full flex items-center gap-2.5 p-2 rounded-[6px] bg-raised hover:bg-hover border border-line transition-all text-left cursor-pointer"
          title="Receptionist Profile & Station Settings"
        >
          <div className="w-7 h-7 rounded-[4px] bg-app border border-line flex items-center justify-center shrink-0 text-ink font-condensed font-bold text-xs tracking-wider">
            {receptionistName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          {!compact && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-ink truncate leading-tight">
                {receptionistName}
              </div>
              <div className="text-[10px] text-muted truncate mt-0.5">
                {receptionistShift}
              </div>
            </div>
          )}
        </button>

        {!compact && (
          <div className="px-2 py-1 flex items-center justify-between text-[10px] text-muted font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              <span>Desk 01 Active</span>
            </span>
            <span className="text-muted">PKT UTC+5</span>
          </div>
        )}
      </div>
      </aside>
    </>
  );
};
