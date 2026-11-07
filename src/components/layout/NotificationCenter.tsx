import React from 'react';
import { X, AlertTriangle, Clock, CheckCircle, MessageSquare, Send } from 'lucide-react';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { Member } from '../../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: Member) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onSelectMember,
}) => {
  if (!isOpen) return null;

  const expiringList = WhatsAppService.getMembersExpiringIn3Days();
  const members = db.getMembers();
  const overdueMembers = members.filter((m) => m.balanceDue > 0);

  const handleSendReminder = (m: Member) => {
    const { url } = WhatsAppService.trigger3DayExpiryReminder(m);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex justify-end">
      <div className="w-full max-w-md bg-raised border-l border-line h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-line flex items-center justify-between bg-panel">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-ink font-condensed uppercase tracking-[0.04em]">
              Notification & Expiry Center
            </h2>
            <span className="text-[10px] bg-app text-brand border border-line px-2 py-0.5 rounded-[4px] font-mono font-bold">
              {expiringList.length + overdueMembers.length} alerts
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded-[4px] hover:bg-raised cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Section 1: 3-Day Expiry Reminders */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-warn">
              <Clock className="w-3.5 h-3.5" />
              <span>3-Day Expiry Alerts ({expiringList.length})</span>
            </div>
            {expiringList.length === 0 ? (
              <div className="p-3 rounded-[6px] bg-panel border border-line text-xs text-muted flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-ok shrink-0" />
                <span>No memberships expiring within the next 3 days.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringList.map(({ member, daysLeft, sentToday }) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-[6px] bg-panel border border-line text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-ink">{member.fullName}</div>
                        <div className="text-[11px] text-muted font-mono mt-0.5">
                          ID: <span className="text-brand font-bold">{member.rollNumber}</span> · {member.mobileNumber}
                        </div>
                      </div>
                      <span className="status-pill-warning text-[10px] py-0 px-2 tabular-nums">
                        {daysLeft === 0 ? 'Expires Today' : `${daysLeft} Day${daysLeft > 1 ? 's' : ''} Left`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSendReminder(member)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-brand hover:bg-brand-strong text-white rounded-[4px] text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3 stroke-[1.5]" />
                        <span>{sentToday ? 'Re-Send WhatsApp' : 'Send WhatsApp Reminder'}</span>
                      </button>
                      <button
                        onClick={() => {
                          onSelectMember(member);
                          onClose();
                        }}
                        className="py-1.5 px-3 bg-raised hover:bg-hover text-ink border border-line rounded-[4px] text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Outstanding Payment Alerts */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-bad">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Outstanding Balances ({overdueMembers.length})</span>
            </div>
            {overdueMembers.length === 0 ? (
              <div className="p-3 rounded-[6px] bg-panel border border-line text-xs text-muted flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-ok shrink-0" />
                <span>All member dues are settled.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueMembers.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-[6px] bg-panel border border-line text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-ink">{m.fullName}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        ID: <span className="text-ink font-bold">{m.rollNumber}</span> · {m.mobileNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-bad font-bold text-xs tabular-nums">
                        Rs. {m.balanceDue.toLocaleString()}
                      </div>
                      <button
                        onClick={() => {
                          onSelectMember(m);
                          onClose();
                        }}
                        className="text-[10px] text-brand hover:underline cursor-pointer font-semibold mt-0.5 block"
                      >
                        Collect &gt;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-line bg-panel text-center">
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-raised hover:bg-hover text-ink border border-line text-xs font-semibold rounded-[6px] transition-colors cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
