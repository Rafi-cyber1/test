import React from 'react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  currentUser,
}) => {
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
    <aside
      className={`bg-[#15171A] border-r border-[#262A30] flex flex-col justify-between transition-all duration-150 ease-out select-none ${
        isCollapsed ? 'w-16' : 'w-[232px]'
      } shrink-0 relative h-full`}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Logo Section: Top-left, height 32-36px, with 20px padding */}
        <div className={`${isCollapsed ? 'p-2' : 'p-5 pb-4'} border-b border-[#262A30] flex items-center justify-between`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <GymTownLogo size="sm" showText={false} />
              <div className="flex flex-col min-w-0">
                <span className="font-condensed text-base font-bold text-[#ECEAE6] tracking-[0.04em] uppercase truncate leading-none">
                  THE GYM TOWN
                </span>
                <span className="text-[10px] text-[#8B909A] font-medium tracking-wider uppercase mt-1 truncate">
                  Hyderabad Station
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <GymTownLogo size="xs" showText={false} />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className={`text-[#8B909A] hover:text-[#ECEAE6] p-1 rounded-[4px] hover:bg-[#1C1F23] transition-colors cursor-pointer ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Expand toggle when collapsed */}
        {isCollapsed && (
          <div className="py-2 flex justify-center border-b border-[#262A30]">
            <button
              onClick={onToggleCollapse}
              className="text-[#8B909A] hover:text-[#ECEAE6] p-1 rounded-[4px] hover:bg-[#1C1F23] transition-colors cursor-pointer"
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
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold">
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
                        ? 'border-l-2 border-[#D9383A] bg-[#1C1F23] text-[#ECEAE6] font-semibold'
                        : 'border-l-2 border-transparent text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]/60 font-medium'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 stroke-[1.5] ${isActive ? 'text-[#D9383A]' : 'currentColor'}`} />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}

                    {!isCollapsed && item.badge !== undefined && (
                      <span className="font-mono text-[10px] font-semibold text-[#8B909A] bg-[#0D0E10] px-1.5 py-0.2 rounded-full border border-[#262A30] tabular-nums">
                        {item.badge}
                      </span>
                    )}

                    {!isCollapsed && item.alert !== undefined && (
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
      <div className="p-3 border-t border-[#262A30] bg-[#15171A] space-y-2 shrink-0">
        <button
          onClick={() => onTabChange('settings')}
          className="w-full flex items-center gap-2.5 p-2 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] transition-all text-left cursor-pointer"
          title="Receptionist Profile & Station Settings"
        >
          <div className="w-7 h-7 rounded-[4px] bg-[#0D0E10] border border-[#262A30] flex items-center justify-center shrink-0 text-[#ECEAE6] font-condensed font-bold text-xs tracking-wider">
            {receptionistName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#ECEAE6] truncate leading-tight">
                {receptionistName}
              </div>
              <div className="text-[10px] text-[#8B909A] truncate mt-0.5">
                {receptionistShift}
              </div>
            </div>
          )}
        </button>

        {!isCollapsed && (
          <div className="px-2 py-1 flex items-center justify-between text-[10px] text-[#8B909A] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3DB88B]" />
              <span>Desk 01 Active</span>
            </span>
            <span className="text-[#8B909A]">PKT UTC+5</span>
          </div>
        )}
      </div>
    </aside>
  );
};
