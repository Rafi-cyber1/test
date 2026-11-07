import React, { useState } from 'react';
import {
  MessageSquare,
  Clock,
  Send,
  Calendar,
  Check,
} from 'lucide-react';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { Member } from '../../types';

export const WhatsAppManager: React.FC = () => {
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [, setRefreshKey] = useState(0);

  const reload = () => setRefreshKey((k) => k + 1);

  const notifications = db.getNotifications();
  const expiringList = WhatsAppService.getMembersExpiringIn3Days();

  const handleTriggerOfficialReminder = (member: Member) => {
    const { url } = WhatsAppService.trigger3DayExpiryReminder(member);
    setSentMap((prev) => ({ ...prev, [member.id]: true }));
    window.open(url, '_blank');
    reload();
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-app text-ink">
      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-panel border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-ink">
              WhatsApp Expiry Notifications & Alerts
            </h2>
            <span className="font-mono text-xs text-warn bg-raised px-2 py-0.5 rounded-[4px] border border-line">
              {expiringList.length} Due for Alert
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Automated 3-day expiry alerts with pre-filled WhatsApp link generation and duplicate prevention.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-ok bg-raised px-3 py-1.5 rounded-[6px] border border-line">
          <Clock className="w-3.5 h-3.5 text-ok" />
          <span>3-Day Engine Active</span>
        </div>
      </div>

      {/* Expiring Members Requiring Reminders Table */}
      <div className="border border-line rounded-[8px] bg-panel overflow-hidden">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
            Members Expiring within 3 Days ({expiringList.length})
          </h3>
          <span className="text-xs text-muted">Direct pre-filled WhatsApp dispatch</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-raised text-muted text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Roll #</th>
                <th className="py-2.5 px-4 font-semibold">Member Name</th>
                <th className="py-2.5 px-4 font-semibold">WhatsApp Number</th>
                <th className="py-2.5 px-4 font-semibold">Current Plan</th>
                <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {expiringList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No members have memberships expiring within the next 3 days. All records up to date.
                  </td>
                </tr>
              ) : (
                expiringList.map((item) => {
                  const m = item.member;
                  const isSent = sentMap[m.id];

                  return (
                    <tr key={m.id} className="h-11 hover:bg-raised/50 transition-colors">
                      <td className="py-2 px-4 font-mono font-bold text-ink">{m.rollNumber}</td>
                      <td className="py-2 px-4 font-medium text-ink">{m.fullName}</td>
                      <td className="py-2 px-4 font-mono text-muted">{m.whatsappNumber}</td>
                      <td className="py-2 px-4 text-muted">{m.planName}</td>
                      <td className="py-2 px-4 font-mono text-warn font-semibold tabular-nums">{m.expiryDate}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => handleTriggerOfficialReminder(m)}
                          className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all cursor-pointer ${
                            isSent
                              ? 'bg-raised border border-line text-ok'
                              : 'bg-brand hover:bg-brand-strong text-white'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSent ? 'Sent' : 'Send Reminder'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatched WhatsApp Notifications History */}
      <div className="border border-line rounded-[8px] bg-panel overflow-hidden">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
            Dispatch Audit Log ({notifications.length})
          </h3>
          <span className="text-xs text-muted">Historical message receipts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-raised text-muted text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Recipient</th>
                <th className="py-2.5 px-4 font-semibold">Phone</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">Message Preview</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No WhatsApp notifications logged yet. Sent alerts will appear here.
                  </td>
                </tr>
              ) : (
                notifications.slice(0, 50).map((n) => (
                  <tr key={n.id} className="h-11 hover:bg-raised/50 transition-colors">
                    <td className="py-2 px-4 font-mono text-muted text-[11px]">
                      {n.createdAt.split('T')[0]} {n.createdAt.split('T')[1]?.substring(0, 5)}
                    </td>
                    <td className="py-2 px-4 font-medium text-ink">{n.memberName}</td>
                    <td className="py-2 px-4 font-mono text-muted">{n.whatsappNumber}</td>
                    <td className="py-2 px-4">
                      <span className="status-pill-neutral text-[10px]">{n.messageType}</span>
                    </td>
                    <td className="py-2 px-4 text-muted truncate max-w-sm">{n.messageText}</td>
                    <td className="py-2 px-4 text-center">
                      <span className="status-pill-success">Dispatched</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
