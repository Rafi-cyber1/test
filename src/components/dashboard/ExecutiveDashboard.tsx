import React, { useState } from 'react';
import {
  Users,
  CheckCircle,
  Send,
} from 'lucide-react';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { Member } from '../../types';

interface ExecutiveDashboardProps {
  onNavigate: (tab: string) => void;
  onSelectMember: (member: Member) => void;
  onOpenNewMember: () => void;
  onOpenQuickPayment: () => void;
  onOpenMonthlyRenewal?: (rollNumber?: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onNavigate,
  onSelectMember,
  onOpenNewMember,
  onOpenMonthlyRenewal,
}) => {
  const [sentAlertMap, setSentAlertMap] = useState<Record<string, boolean>>({});

  const members = db.getMembers();
  const attendance = db.getAttendance();
  const todayStr = new Date().toISOString().split('T')[0];

  // Metrics
  const activeMembers = members.filter((m) => m.status === 'ACTIVE').length;
  const expiringSoonMembers = WhatsAppService.getMembersExpiringIn3Days();
  const todayAttendance = attendance.filter((a) => a.timestamp.startsWith(todayStr)).length;

  // WhatsApp Trigger
  const handleTriggerWhatsApp = (member: Member) => {
    if (sentAlertMap[member.id] || WhatsAppService.isReminderSentToday(member)) return;
    const { url } = WhatsAppService.trigger3DayExpiryReminder(member);
    setSentAlertMap((prev) => ({ ...prev, [member.id]: true }));
    window.open(url, '_blank');
  };

  // Mock past 7 days attendance sparkline for the clean chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().split('T')[0];
    const count = attendance.filter((a) => a.timestamp.startsWith(dayStr)).length;
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    return { dayStr, label, count };
  });

  const maxAtt = Math.max(1, ...last7Days.map((d) => d.count));

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-app text-ink">
      <div className="border border-line rounded-[8px] bg-panel grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line overflow-hidden">
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
            Today Visits
          </span>
          <div className="font-condensed text-2xl font-bold text-ink tabular-nums mt-1">
            {todayAttendance}
          </div>
          <span className="text-[10px] text-muted mt-1 block">Check-in counter logs</span>
        </div>

        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
            Active Members
          </span>
          <div className="font-condensed text-2xl font-bold text-ink tabular-nums mt-1">
            {activeMembers}
          </div>
          <span className="text-[10px] text-muted mt-1 block">
            Of {members.length} registered
          </span>
        </div>

        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
            Expiring Soon
          </span>
          <div className="font-condensed text-2xl font-bold text-warn tabular-nums mt-1">
            {expiringSoonMembers.length}
          </div>
          <span className="text-[10px] text-warn font-medium mt-1 block">
            Within next 3 days
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 rounded-[8px] bg-panel border border-line flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-condensed uppercase tracking-[0.04em] text-xs font-bold text-ink">
                Weekly Attendance Activity
              </span>
              <span className="text-[11px] text-muted block mt-0.5">
                Past 7 days turnstile and manual attendance volume
              </span>
            </div>
            <span className="font-mono text-xs text-muted">
              Today: <strong className="text-ink">{todayAttendance}</strong>
            </span>
          </div>

          {/* SVG Bar Chart with clean muted lines */}
          <div className="h-28 flex items-end justify-between gap-3 pt-3 border-b border-line px-2">
            {last7Days.map((d, i) => {
              const heightPct = Math.max(8, Math.round((d.count / maxAtt) * 100));
              const isToday = i === 6;

              return (
                <div key={d.dayStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="font-mono text-[10px] text-muted tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.count}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[36px] rounded-t-[4px] transition-all duration-150 ${
                      isToday
                        ? 'bg-brand'
                        : 'bg-hover group-hover:bg-hover-strong'
                    }`}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted font-semibold mt-1">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border border-line rounded-[8px] bg-panel flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Membership Expiring Soon ({expiringSoonMembers.length})
              </h3>
              <span className="text-[11px] text-muted">
                Requires renewal notice within 3 days
              </span>
            </div>

          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line bg-raised text-muted text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 font-semibold">Member</th>
                  <th className="py-2 px-3 font-semibold">Phone</th>
                  <th className="py-2 px-3 font-semibold">Remaining</th>
                  <th className="py-2 px-3 font-semibold">Expiry</th>
                  <th className="py-2 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {expiringSoonMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted text-xs">
                      No memberships expiring in the next 3 days.
                    </td>
                  </tr>
                ) : (
                  expiringSoonMembers.map((item) => {
                    const m = item.member;
                    return (
                      <tr key={m.id} className="h-11 hover:bg-raised/60 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-medium text-ink truncate">{m.fullName}</div>
                          <span className="font-mono text-[10px] text-muted">{m.rollNumber}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-muted">{m.mobileNumber}</td>
                        <td className="py-2 px-3 text-warn">{item.daysLeft} day{item.daysLeft === 1 ? '' : 's'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-warn tabular-nums">
                          {m.expiryDate}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleTriggerWhatsApp(m)}
                              disabled={sentAlertMap[m.id] || item.sentToday}
                              className="inline-flex items-center gap-1.5 rounded-[4px] bg-raised px-2 py-1 text-[11px] text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                              title={item.sentToday || sentAlertMap[m.id] ? 'Reminder already opened today' : 'Open WhatsApp with reminder text'}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{item.sentToday || sentAlertMap[m.id] ? 'Reminder opened' : 'Send WhatsApp Message'}</span>
                            </button>
                            <button
                              onClick={() => {
                                if (onOpenMonthlyRenewal) {
                                  onOpenMonthlyRenewal(m.rollNumber);
                                } else {
                                  onSelectMember(m);
                                }
                              }}
                              className="px-2.5 py-1 rounded-[4px] bg-raised hover:bg-hover border border-line text-ink text-xs font-semibold cursor-pointer"
                            >
                              Renew plan
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

    </div>
  );
};
