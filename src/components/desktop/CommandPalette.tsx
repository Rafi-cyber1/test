import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Users, 
  CreditCard, 
  CheckCircle, 
  Settings, 
  FileText, 
  UserPlus, 
  RefreshCw, 
  X,
  ShoppingBag,
  Droplet,
} from 'lucide-react';
import { db } from '../../db/storage';
import { Member } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSelectMember: (member: Member) => void;
  onOpenNewMember: () => void;
  onOpenMonthlyRenewal?: (rollNumber?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectMember,
  onOpenNewMember,
  onOpenMonthlyRenewal,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const members = db.getMembers();
  const filteredMembers = query.trim()
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query.toLowerCase()) ||
          m.rollNumber.toLowerCase().includes(query.toLowerCase()) ||
          m.mobileNumber.includes(query)
      ).slice(0, 6)
    : [];

  const navigationCommands = [
    { label: 'Reception Desk Dashboard', tab: 'dashboard', icon: FileText },
    { label: 'Member Directory & Profiles', tab: 'members', icon: Users },
    { label: 'Blood Group Directory', tab: 'blood', icon: Droplet },
    { label: 'Inventory & Daily Sales (POS)', tab: 'inventory', icon: ShoppingBag },
    { label: 'Membership Plans & Fee Rates (PKR)', tab: 'plans', icon: CreditCard },
    { label: 'Manual Attendance Check-In', tab: 'attendance', icon: CheckCircle },
    { label: 'Member Fee Record & Payment Collection', tab: 'ledger', icon: CreditCard },
    { label: 'Station Settings & Backup', tab: 'settings', icon: Settings },
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-start justify-center pt-16 p-4">
      <div className="w-full max-w-xl bg-[#1C1F23] border border-[#262A30] rounded-[8px] shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#262A30] bg-[#15171A]">
          <Search className="w-4 h-4 text-[#D9383A] shrink-0 stroke-[1.5]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member unique ID, name, phone, or run command (Ctrl+K)..."
            className="w-full bg-transparent text-xs text-[#ECEAE6] placeholder:text-[#8B909A] focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#8B909A] hover:text-[#ECEAE6] cursor-pointer">
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          )}
          <span className="text-[10px] font-mono text-[#8B909A] bg-[#1C1F23] px-1.5 py-0.5 rounded-[4px] border border-[#262A30]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[#262A30]">
          {/* Quick Actions section */}
          <div className="pb-2">
            <div className="text-[10px] font-bold tracking-wider text-[#8B909A] uppercase px-3 py-1">
              Quick Front Desk Actions
            </div>

            {onOpenMonthlyRenewal && (
              <button
                onClick={() => {
                  onOpenMonthlyRenewal();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs text-[#ECEAE6] hover:bg-[#15171A] hover:text-[#D9383A] transition-colors text-left cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#D9383A] stroke-[1.5]" />
                <span>Renew Monthly Fee (Enter Unique ID, e.g. the-gym-town-01)</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenNewMember();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs text-[#ECEAE6] hover:bg-[#15171A] transition-colors text-left cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#ECEAE6] stroke-[1.5]" />
              <span>Enroll New Member (Rs. 4,000 Advance / Rs. 2,000 Regular)</span>
            </button>

            <button
              onClick={() => {
                onNavigate('attendance');
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs text-[#ECEAE6] hover:bg-[#15171A] transition-colors text-left cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5 text-[#3DB88B] stroke-[1.5]" />
              <span>Manual Attendance Check-In Register</span>
            </button>
          </div>

          {/* Members matching query */}
          {filteredMembers.length > 0 && (
            <div className="py-2">
              <div className="text-[10px] font-bold tracking-wider text-[#8B909A] uppercase px-3 py-1">
                Matched Members ({filteredMembers.length})
              </div>
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-xs text-[#ECEAE6] hover:bg-[#15171A] transition-colors"
                >
                  <div
                    onClick={() => {
                      onSelectMember(m);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  >
                    <span className="font-mono text-xs text-[#D9383A] bg-[#0D0E10] px-1.5 py-0.5 rounded-[4px] border border-[#262A30] font-bold">
                      {m.rollNumber}
                    </span>
                    <span className="font-semibold text-[#ECEAE6] truncate">{m.fullName}</span>
                    <span className="text-[11px] text-[#8B909A] truncate">· {m.mobileNumber}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#8B909A]">{m.planName}</span>
                    {onOpenMonthlyRenewal && (
                      <button
                        onClick={() => {
                          onOpenMonthlyRenewal(m.rollNumber);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded-[4px] bg-[#1C1F23] hover:bg-[#D9383A] hover:text-[#ECEAE6] border border-[#262A30] text-[10px] font-semibold text-[#ECEAE6] transition-colors cursor-pointer"
                      >
                        Renew
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation Commands */}
          <div className="pt-2">
            <div className="text-[10px] font-bold tracking-wider text-[#8B909A] uppercase px-3 py-1">
              Modules Navigation
            </div>
            {navigationCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.tab}
                  onClick={() => {
                    onNavigate(cmd.tab);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[6px] text-xs text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#15171A] transition-colors text-left cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5 text-[#8B909A] stroke-[1.5]" />
                  <span>{cmd.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
