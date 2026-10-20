import React, { useState } from 'react';
import {
  Users,
  CheckCircle,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Search,
  Check,
  Send,
  Printer,
  X,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { Member, PaymentMethod, PaymentRecord } from '../../types';
import { PrintableReceipt } from '../finance/PrintableReceipt';

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
  const [quickCheckInInput, setQuickCheckInInput] = useState('');
  const [quickCheckInResult, setQuickCheckInResult] = useState<{
    status: 'IDLE' | 'SUCCESS' | 'DENIED';
    message: string;
    member?: Member;
  }>({ status: 'IDLE', message: '' });

  // Slide-over drawer for fee collection
  const [showCollectDrawer, setShowCollectDrawer] = useState(false);
  const [collectMember, setCollectMember] = useState<Member | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(2000);
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('Cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentRecord | null>(null);

  const members = db.getMembers();
  const payments = db.getPayments();
  const attendance = db.getAttendance();
  const todayStr = new Date().toISOString().split('T')[0];

  // Metrics
  const activeMembers = members.filter((m) => m.status === 'ACTIVE').length;
  const expiringSoonMembers = WhatsAppService.getMembersExpiringIn3Days();
  const unpaidMembers = members.filter((m) => m.balanceDue > 0);
  const totalOutstanding = unpaidMembers.reduce((sum, m) => sum + m.balanceDue, 0);

  const todayPayments = payments.filter((p) => p.createdAt.startsWith(todayStr));
  const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const todayCashInHand = todayPayments
    .filter((p) => p.paymentMethod === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);
  const todayAttendance = attendance.filter((a) => a.timestamp.startsWith(todayStr)).length;

  // WhatsApp Trigger
  const handleTriggerWhatsApp = (member: Member) => {
    const { url } = WhatsAppService.trigger3DayExpiryReminder(member);
    setSentAlertMap((prev) => ({ ...prev, [member.id]: true }));
    window.open(url, '_blank');
  };

  // Quick Check-in
  const handleDeskCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCheckInInput.trim()) return;

    const query = quickCheckInInput.trim().toLowerCase();
    const cleanNum = quickCheckInInput.replace(/[^\d]/g, '');

    const matchedMember = members.find(
      (m) =>
        m.rollNumber.toLowerCase() === query ||
        m.rollNumber.toLowerCase().endsWith(query) ||
        (cleanNum.length >= 7 && m.mobileNumber.replace(/[^\d]/g, '').endsWith(cleanNum)) ||
        m.fullName.toLowerCase().includes(query)
    );

    if (!matchedMember) {
      setQuickCheckInResult({
        status: 'DENIED',
        message: `No member found matching "${quickCheckInInput}"`,
      });
      return;
    }

    const access = db.verifyDoorAccess(matchedMember.id, 'MANUAL');
    if (access.granted) {
      db.recordAttendance({
        memberId: matchedMember.id,
        rollNumber: matchedMember.rollNumber,
        memberName: matchedMember.fullName,
        method: 'MANUAL',
        accessStatus: 'GRANTED',
        notes: 'Front counter quick check-in',
      });
      setQuickCheckInResult({
        status: 'SUCCESS',
        message: `Access granted: ${matchedMember.fullName} (${matchedMember.rollNumber})`,
        member: matchedMember,
      });
      setQuickCheckInInput('');
    } else {
      setQuickCheckInResult({
        status: 'DENIED',
        message: `Access denied: ${access.reason}`,
        member: matchedMember,
      });
    }
  };

  const handleOpenCollect = (member: Member) => {
    setCollectMember(member);
    setCollectAmount(member.balanceDue > 0 ? member.balanceDue : 2000);
    setCollectMethod('Cash');
    setCollectNotes('');
    setCollectError(null);
    setShowCollectDrawer(true);
  };

  const handleCollectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectMember) return;
    if (!Number.isFinite(collectAmount) || collectAmount <= 0 || collectAmount > collectMember.balanceDue) {
      setCollectError('Enter an amount greater than zero and no higher than the outstanding balance.');
      return;
    }

    try {
      const payment = db.recordPayment({
        memberId: collectMember.id,
        rollNumber: collectMember.rollNumber,
        memberName: collectMember.fullName,
        amount: collectAmount,
        paymentMethod: collectMethod,
        paymentType: 'MEMBERSHIP',
        notes: collectNotes || `Counter collection (${collectMember.planName})`,
      });
      setShowCollectDrawer(false);
      setReceiptToPrint(payment);
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : 'Unable to record the payment.');
    }
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
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0D0E10] text-[#ECEAE6]">
      {/* 1. ONE CONNECTED KPI STRIP: Single bordered container with vertical dividers */}
      <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-[#262A30] overflow-hidden">
        {/* Cell 1: Today Collections */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Today Collections
          </span>
          <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
            Rs. {todayRevenue.toLocaleString()}
          </div>
          <span className="text-[10px] text-[#8B909A] mt-1 block">
            {todayPayments.length} transactions
          </span>
        </div>

        {/* Cell 2: Cash in Drawer */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Cash in Hand
          </span>
          <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
            Rs. {todayCashInHand.toLocaleString()}
          </div>
          <span className="text-[10px] text-[#8B909A] mt-1 block">Front counter physical cash</span>
        </div>

        {/* Cell 3: Today Check-Ins */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Today Visits
          </span>
          <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
            {todayAttendance}
          </div>
          <span className="text-[10px] text-[#8B909A] mt-1 block">Check-in counter logs</span>
        </div>

        {/* Cell 4: Active Memberships */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Active Members
          </span>
          <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
            {activeMembers}
          </div>
          <span className="text-[10px] text-[#8B909A] mt-1 block">
            Of {members.length} registered
          </span>
        </div>

        {/* Cell 5: Outstanding Balance */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Pending Fees
          </span>
          <div className="font-condensed text-2xl font-bold text-[#E5484D] tabular-nums mt-1">
            Rs. {totalOutstanding.toLocaleString()}
          </div>
          <span className="text-[10px] text-[#E5484D] font-medium mt-1 block">
            {unpaidMembers.length} members with dues
          </span>
        </div>

        {/* Cell 6: Expiring Soon */}
        <div className="p-4">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
            Expiring Soon
          </span>
          <div className="font-condensed text-2xl font-bold text-[#E5AE4A] tabular-nums mt-1">
            {expiringSoonMembers.length}
          </div>
          <span className="text-[10px] text-[#E5AE4A] font-medium mt-1 block">
            Within next 3 days
          </span>
        </div>
      </div>

      {/* 2. Middle Row: Desk Check-in Bar + Weekly Attendance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Check-In Bar */}
        <div className="lg:col-span-1 p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-condensed uppercase tracking-[0.04em] text-xs font-bold text-[#ECEAE6]">
                Quick Desk Check-In
              </span>
              <span className="text-[10px] text-[#8B909A]">Type and press Enter</span>
            </div>

            <form onSubmit={handleDeskCheckIn} className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
                <input
                  type="text"
                  value={quickCheckInInput}
                  onChange={(e) => setQuickCheckInInput(e.target.value)}
                  placeholder="Roll #, phone, or name..."
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-2 text-xs text-[#ECEAE6] placeholder:text-[#8B909A] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer"
                >
                  Log Check-In
                </button>
                {onOpenMonthlyRenewal && (
                  <button
                    type="button"
                    onClick={() => onOpenMonthlyRenewal(quickCheckInInput || undefined)}
                    className="px-2.5 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[#ECEAE6] text-xs font-semibold transition-all duration-150 cursor-pointer"
                    title="Renew Monthly Fee by ID (e.g. the-gym-town-01)"
                  >
                    Renew Fee
                  </button>
                )}
              </div>
            </form>
          </div>

          {quickCheckInResult.status !== 'IDLE' && (
            <div
              className={`mt-3 p-2.5 rounded-[6px] border text-xs font-medium ${
                quickCheckInResult.status === 'SUCCESS'
                  ? 'bg-[#1C1F23] border-[#262A30] text-[#3DB88B] border-l-4 border-l-[#3DB88B]'
                  : 'bg-[#1C1F23] border-[#262A30] text-[#E5484D] border-l-4 border-l-[#E5484D]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {quickCheckInResult.status === 'SUCCESS' ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{quickCheckInResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Clean 7-Day Attendance Chart with muted gridlines & accent line */}
        <div className="lg:col-span-2 p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-condensed uppercase tracking-[0.04em] text-xs font-bold text-[#ECEAE6]">
                Weekly Attendance Activity
              </span>
              <span className="text-[11px] text-[#8B909A] block mt-0.5">
                Past 7 days turnstile and manual attendance volume
              </span>
            </div>
            <span className="font-mono text-xs text-[#8B909A]">
              Today: <strong className="text-[#ECEAE6]">{todayAttendance}</strong>
            </span>
          </div>

          {/* SVG Bar Chart with clean muted lines */}
          <div className="h-28 flex items-end justify-between gap-3 pt-3 border-b border-[#262A30] px-2">
            {last7Days.map((d, i) => {
              const heightPct = Math.max(8, Math.round((d.count / maxAtt) * 100));
              const isToday = i === 6;

              return (
                <div key={d.dayStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="font-mono text-[10px] text-[#8B909A] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.count}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[36px] rounded-t-[4px] transition-all duration-150 ${
                      isToday
                        ? 'bg-[#D9383A]'
                        : 'bg-[#262A30] group-hover:bg-[#363B44]'
                    }`}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-[#8B909A] font-semibold mt-1">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Tables Row: "Pending Fees" & "Expiring Memberships" as compact tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table 1: Pending Fees */}
        <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
            <div>
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                Pending Fees ({unpaidMembers.length})
              </h3>
              <span className="text-[11px] text-[#8B909A]">
                Total dues: Rs. {totalOutstanding.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => onNavigate('finance')}
              className="text-xs text-[#8B909A] hover:text-[#ECEAE6] flex items-center gap-1 cursor-pointer"
            >
              <span>View register</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 font-semibold">Member</th>
                  <th className="py-2 px-3 font-semibold">Plan</th>
                  <th className="py-2 px-3 font-semibold text-right">Balance Due</th>
                  <th className="py-2 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A30]">
                {unpaidMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#8B909A] text-xs">
                      No members with pending dues. All payments are clear.
                    </td>
                  </tr>
                ) : (
                  unpaidMembers.slice(0, 6).map((m) => (
                    <tr key={m.id} className="h-11 hover:bg-[#1C1F23]/60 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-medium text-[#ECEAE6] truncate">{m.fullName}</div>
                        <span className="font-mono text-[10px] text-[#8B909A]">{m.rollNumber}</span>
                      </td>
                      <td className="py-2 px-3 text-[#8B909A] truncate max-w-[120px]">{m.planName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[#E5484D] tabular-nums">
                        Rs. {m.balanceDue.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleOpenCollect(m)}
                          className="px-2.5 py-1 rounded-[4px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Collect fee
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Expiring Memberships */}
        <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
            <div>
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                Expiring Memberships ({expiringSoonMembers.length})
              </h3>
              <span className="text-[11px] text-[#8B909A]">
                Requires renewal notice within 3 days
              </span>
            </div>

            <button
              onClick={() => onNavigate('whatsapp')}
              className="text-xs text-[#8B909A] hover:text-[#ECEAE6] flex items-center gap-1 cursor-pointer"
            >
              <span>Broadcast alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3 font-semibold">Member</th>
                  <th className="py-2 px-3 font-semibold">Plan</th>
                  <th className="py-2 px-3 font-semibold">Expiry</th>
                  <th className="py-2 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A30]">
                {expiringSoonMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#8B909A] text-xs">
                      No memberships expiring in the next 3 days.
                    </td>
                  </tr>
                ) : (
                  expiringSoonMembers.slice(0, 6).map((item) => {
                    const m = item.member;
                    return (
                      <tr key={m.id} className="h-11 hover:bg-[#1C1F23]/60 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-medium text-[#ECEAE6] truncate">{m.fullName}</div>
                          <span className="font-mono text-[10px] text-[#8B909A]">{m.rollNumber}</span>
                        </td>
                        <td className="py-2 px-3 text-[#8B909A] truncate max-w-[120px]">{m.planName}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#E5AE4A] tabular-nums">
                          {m.expiryDate}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleTriggerWhatsApp(m)}
                              className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] hover:bg-[#1C1F23] cursor-pointer"
                              title="Send WhatsApp notice"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (onOpenMonthlyRenewal) {
                                  onOpenMonthlyRenewal(m.rollNumber);
                                } else {
                                  onSelectMember(m);
                                }
                              }}
                              className="px-2.5 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[#ECEAE6] text-xs font-semibold cursor-pointer"
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

      {/* Slide-Over Drawer: Collect Fee (Right Side 480px) */}
      {showCollectDrawer && collectMember && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="w-[480px] max-w-full bg-[#1C1F23] border-l border-[#262A30] h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#262A30] flex items-center justify-between bg-[#15171A]">
              <div>
                <h3 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6]">
                  Collect Member Fee
                </h3>
                <span className="text-xs text-[#8B909A]">
                  {collectMember.fullName} ({collectMember.rollNumber})
                </span>
              </div>
              <button onClick={() => setShowCollectDrawer(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-[6px] bg-[#15171A] border border-[#262A30] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Membership Plan:</span>
                  <span className="font-semibold text-[#ECEAE6]">{collectMember.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Total Package Fee:</span>
                  <span className="font-mono text-[#ECEAE6] tabular-nums">Rs. {collectMember.totalFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Already Paid:</span>
                  <span className="font-mono text-[#3DB88B] tabular-nums">Rs. {collectMember.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-[#262A30] pt-1.5 font-bold">
                  <span className="text-[#ECEAE6]">Remaining Due:</span>
                  <span className="font-mono text-[#E5484D] tabular-nums">Rs. {collectMember.balanceDue.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={collectMember.balanceDue}
                  value={collectAmount}
                  onChange={(e) => {
                    setCollectAmount(Number(e.target.value));
                    setCollectError(null);
                  }}
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
                {collectError && <p role="alert" className="mt-1 text-[11px] text-[#E5484D]">{collectError}</p>}
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Cash', 'JazzCash', 'EasyPaisa', 'Card'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCollectMethod(method)}
                      className={`py-1.5 rounded-[6px] border text-[11px] font-semibold text-center cursor-pointer ${
                        collectMethod === method
                          ? 'bg-[#D9383A] border-[#D9383A] text-[#ECEAE6]'
                          : 'bg-[#15171A] border-[#262A30] text-[#8B909A]'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Receipt Reference / Note (Optional)
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="e.g. Paid at front reception counter"
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectDrawer(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#15171A] text-xs font-semibold text-[#ECEAE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
                >
                  Confirm & Print Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptToPrint && (
        <PrintableReceipt
          payment={receiptToPrint}
          onClose={() => setReceiptToPrint(null)}
          autoTriggerPrint
        />
      )}
    </div>
  );
};
