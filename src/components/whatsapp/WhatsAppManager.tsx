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
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0D0E10] text-[#ECEAE6]">
      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
              WhatsApp Expiry Notifications & Alerts
            </h2>
            <span className="font-mono text-xs text-[#E5AE4A] bg-[#1C1F23] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
              {expiringList.length} Due for Alert
            </span>
          </div>
          <p className="text-xs text-[#8B909A] mt-1">
            Automated 3-day expiry alerts with pre-filled WhatsApp link generation and duplicate prevention.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#3DB88B] bg-[#1C1F23] px-3 py-1.5 rounded-[6px] border border-[#262A30]">
          <Clock className="w-3.5 h-3.5 text-[#3DB88B]" />
          <span>3-Day Engine Active</span>
        </div>
      </div>

      {/* Expiring Members Requiring Reminders Table */}
      <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
        <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
          <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
            Members Expiring within 3 Days ({expiringList.length})
          </h3>
          <span className="text-xs text-[#8B909A]">Direct pre-filled WhatsApp dispatch</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Roll #</th>
                <th className="py-2.5 px-4 font-semibold">Member Name</th>
                <th className="py-2.5 px-4 font-semibold">WhatsApp Number</th>
                <th className="py-2.5 px-4 font-semibold">Current Plan</th>
                <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262A30]">
              {expiringList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8B909A]">
                    No members have memberships expiring within the next 3 days. All records up to date.
                  </td>
                </tr>
              ) : (
                expiringList.map((item) => {
                  const m = item.member;
                  const isSent = sentMap[m.id];

                  return (
                    <tr key={m.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                      <td className="py-2 px-4 font-mono font-bold text-[#ECEAE6]">{m.rollNumber}</td>
                      <td className="py-2 px-4 font-medium text-[#ECEAE6]">{m.fullName}</td>
                      <td className="py-2 px-4 font-mono text-[#8B909A]">{m.whatsappNumber}</td>
                      <td className="py-2 px-4 text-[#8B909A]">{m.planName}</td>
                      <td className="py-2 px-4 font-mono text-[#E5AE4A] font-semibold tabular-nums">{m.expiryDate}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          onClick={() => handleTriggerOfficialReminder(m)}
                          className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all cursor-pointer ${
                            isSent
                              ? 'bg-[#1C1F23] border border-[#262A30] text-[#3DB88B]'
                              : 'bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6]'
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
      <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
        <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
          <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
            Dispatch Audit Log ({notifications.length})
          </h3>
          <span className="text-xs text-[#8B909A]">Historical message receipts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Recipient</th>
                <th className="py-2.5 px-4 font-semibold">Phone</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">Message Preview</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262A30]">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8B909A]">
                    No WhatsApp notifications logged yet. Sent alerts will appear here.
                  </td>
                </tr>
              ) : (
                notifications.slice(0, 50).map((n) => (
                  <tr key={n.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                    <td className="py-2 px-4 font-mono text-[#8B909A] text-[11px]">
                      {n.createdAt.split('T')[0]} {n.createdAt.split('T')[1]?.substring(0, 5)}
                    </td>
                    <td className="py-2 px-4 font-medium text-[#ECEAE6]">{n.memberName}</td>
                    <td className="py-2 px-4 font-mono text-[#8B909A]">{n.whatsappNumber}</td>
                    <td className="py-2 px-4">
                      <span className="status-pill-neutral text-[10px]">{n.messageType}</span>
                    </td>
                    <td className="py-2 px-4 text-[#8B909A] truncate max-w-sm">{n.messageText}</td>
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
