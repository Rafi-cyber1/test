import React, { useState } from 'react';
import {
  X,
  Printer,
  MessageSquare,
  RefreshCw,
  Snowflake,
  Play,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  UserMinus,
} from 'lucide-react';
import { Member, MembershipPlan, PaymentMethod, PaymentRecord } from '../../types';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { PrintableMemberCard } from './PrintableMemberCard';
import { PrintableReceipt } from '../finance/PrintableReceipt';

interface MemberProfileModalProps {
  member: Member;
  onClose: () => void;
  onUpdate: () => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'billing' | 'attendance' | 'actions'>('overview');
  const [showPrintCard, setShowPrintCard] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('Medical rest / travel pause');

  // Collect fee state inside profile
  const [showCollectFeeModal, setShowCollectFeeModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(member.balanceDue > 0 ? member.balanceDue : 2000);
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('Cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentRecord | null>(null);

  // Renewal form
  const activePlans = db.getPlans().filter((p) => p.isActive);
  const plans = activePlans.filter((p) => !p.id.startsWith('plan_admission'));
  const defaultRenewPlanId = member.planId === 'plan_admission_advance'
    ? 'plan_monthly'
    : member.planId === 'plan_admission_muscle'
      ? 'plan_monthly_muscle'
      : member.planId || plans[0]?.id || '';
  const customRenewPlan = !plans.some((p) => p.id === member.planId) && !member.planId.startsWith('plan_admission')
    ? {
        id: member.planId,
        name: member.planName,
        durationDays: 30,
        durationMonths: 1,
        price: member.monthlyFee ?? plans[0]?.price ?? 2000,
        description: 'Member-specific monthly fee',
        isActive: true,
        trainingType: 'CUSTOM' as const,
      }
    : undefined;
  const renewalPlans = customRenewPlan ? [...plans, customRenewPlan] : plans;
  const [renewPlanId, setRenewPlanId] = useState(defaultRenewPlanId);
  const renewalLateFee = member.expiryDate < new Date().toISOString().slice(0, 10) ? 500 : 0;
  const [renewPaidAmount, setRenewPaidAmount] = useState<number>((renewalPlans.find((p) => p.id === defaultRenewPlanId)?.price || 2000) + renewalLateFee);
  const [renewDiscount, setRenewDiscount] = useState<number>(0);
  const [renewMethod, setRenewMethod] = useState<PaymentMethod>('Cash');
  const [renewError, setRenewError] = useState<string | null>(null);

  const attendanceLogs = db.getAttendance().filter((a) => a.memberId === member.id || a.rollNumber === member.rollNumber);
  const payments = db.getPayments().filter((p) => p.memberId === member.id || p.rollNumber === member.rollNumber);
  const history = db.getState().membershipHistory.filter((h) => h.memberId === member.id);

  const selectedRenewPlan = renewalPlans.find((p) => p.id === renewPlanId) || renewalPlans[0];

  const handleSendWhatsApp = () => {
    const text = `Hello ${member.fullName}, greetings from The Gym Town Hyderabad. Regarding your ${member.planName} membership (${member.rollNumber}). Expiry date: ${member.expiryDate}. Outstanding balance: Rs. ${member.balanceDue}.`;
    const url = WhatsAppService.getClickToChatUrl(member.whatsappNumber, text);
    window.open(url, '_blank');
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRenewError(null);
    try {
      const renewed = db.renewMembership(
        member.id,
        renewPlanId,
        Number(renewPaidAmount),
        renewMethod,
        Number(renewDiscount)
      );
      if (!renewed) throw new Error('Unable to renew this membership.');
      if (Number(renewPaidAmount) > 0) {
        const latestPayment = db.getPayments().find((payment) => payment.memberId === member.id);
        if (latestPayment) setReceiptToPrint(latestPayment);
      }
      setShowRenewModal(false);
      onUpdate();
    } catch (error) {
      setRenewError(error instanceof Error ? error.message : 'Unable to renew this membership.');
    }
  };

  const handleFreezeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.freezeMembership(member.id, freezeReason);
    setShowFreezeModal(false);
    onUpdate();
  };

  const handleResume = () => {
    if (confirm(`Restore active membership status for ${member.fullName}?`)) {
      db.resumeMembership(member.id, 0);
      onUpdate();
    }
  };

  const handleCollectFeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCollectError(null);
    if (!Number.isFinite(collectAmount) || collectAmount <= 0 || collectAmount > member.balanceDue) {
      setCollectError('Enter an amount greater than zero and no higher than the outstanding balance.');
      return;
    }
    try {
      const payment = db.recordPayment({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        amount: collectAmount,
        paymentMethod: collectMethod,
        paymentType: 'MEMBERSHIP',
        notes: collectNotes || `Fee collection (${member.planName})`,
      });
      setShowCollectFeeModal(false);
      setReceiptToPrint(payment);
      onUpdate();
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : 'Unable to record the payment.');
    }
  };

  const handleLeaveMember = () => {
    db.leaveMember(member.id);
    onClose();
  };

  // Membership duration calculation
  const getMembershipDuration = () => {
    const regDate = new Date(member.registrationDate || member.startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - regDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;

    if (months > 0) {
      return `${months}m ${remainingDays}d (${diffDays} days)`;
    }
    return `${diffDays} days`;
  };

  const lifetimePaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const membershipPeriods = member.membershipPeriods?.length
    ? member.membershipPeriods
    : [{ id: `mperiod_${member.id}_1`, startDate: member.registrationDate || member.startDate }];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4">
        {/* Modal Container */}
        <div className="w-full max-w-4xl bg-panel border border-line rounded-[8px] overflow-hidden flex flex-col max-h-[90dvh] shadow-2xl">
          {/* Top Bar */}
          <div className="p-3.5 border-b border-line flex items-center justify-between bg-raised">
            <div className="flex items-center gap-2">
              <span className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Member Profile — {member.fullName}
              </span>
              <span className="font-mono text-xs text-brand bg-app px-2 py-0.5 rounded-[4px] border border-line">
                {member.rollNumber}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowPrintCard(true)}
                className="px-2.5 py-1 rounded-[4px] bg-panel hover:bg-hover border border-line text-xs font-semibold text-ink flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
              <button
                onClick={handleSendWhatsApp}
                className="px-2.5 py-1 rounded-[4px] bg-panel hover:bg-hover border border-line text-xs font-semibold text-ok flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 text-muted hover:text-ink rounded-[4px] ml-1 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>
          </div>

          {/* Body: Left Column + Right Tabs Column */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column (260px): Avatar, Name, Plan, Status & Quick Stats */}
            <div className="w-full md:w-[260px] p-5 border-r border-line bg-panel flex flex-col justify-between shrink-0 overflow-y-auto">
              <div className="space-y-4">
                {/* Avatar & Identifiers */}
                <div className="flex flex-col items-center text-center">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-18 h-18 rounded-[8px] object-cover border border-line"
                    />
                  ) : (
                    <div className="w-18 h-18 rounded-[8px] bg-raised border border-line flex items-center justify-center text-ink font-condensed text-2xl font-bold">
                      {member.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <h3 className="font-bold text-sm text-ink mt-2.5 leading-tight">{member.fullName}</h3>
                  <span className="font-mono text-xs text-muted mt-0.5">{member.rollNumber}</span>

                  {/* Status Pill */}
                  <div className="mt-2">
                    {member.status === 'ACTIVE' && <span className="status-pill-success">Active Member</span>}
                    {member.status === 'EXPIRING_SOON' && <span className="status-pill-warning">Expiring Soon</span>}
                    {member.status === 'EXPIRED' && <span className="status-pill-danger">Expired</span>}
                    {member.status === 'FROZEN' && <span className="status-pill-neutral">Frozen</span>}
                    {member.status === 'PENDING_PAYMENT' && <span className="status-pill-danger">Pending Payment</span>}
                  </div>
                </div>

                {/* Plan Badge */}
                <div className="p-3 rounded-[6px] bg-raised border border-line text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Current Plan</div>
                  <div className="font-semibold text-ink">{member.planName}</div>
                  <div className="text-[11px] text-muted font-mono">
                    Valid till: <strong className="text-ink">{member.expiryDate}</strong>
                  </div>
                </div>

                {/* Quick Stats Strip */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-line">
                    <span className="text-muted">Member Since:</span>
                    <span className="font-mono text-ink tabular-nums">{member.registrationDate || member.startDate}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line">
                    <span className="text-muted">Duration:</span>
                    <span className="font-mono text-ink">{getMembershipDuration()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line">
                    <span className="text-muted">Total Visits:</span>
                    <span className="font-mono text-ink font-bold tabular-nums">
                      {member.totalVisits || attendanceLogs.length}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line">
                    <span className="text-muted">Lifetime Paid:</span>
                    <span className="font-mono text-ok font-bold tabular-nums">
                      Rs. {lifetimePaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Outstanding Due:</span>
                    <span className="font-mono text-bad font-bold tabular-nums">
                      Rs. {member.balanceDue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Collect Action */}
              {member.balanceDue > 0 && (
                <button
                  onClick={() => setShowCollectFeeModal(true)}
                  className="w-full mt-4 py-2 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Collect Due (Rs. {member.balanceDue})
                </button>
              )}
            </div>

            {/* Right Column: Underline Tabs & Content */}
            <div className="flex-1 flex flex-col bg-app overflow-hidden">
              {/* Underline Tabs Header */}
              <div className="flex items-center gap-6 px-5 border-b border-line bg-panel">
                {(
                  [
                    { key: 'overview', label: 'Overview' },
                    { key: 'billing', label: `Billing & Payments (${payments.length})` },
                    { key: 'attendance', label: `Attendance (${attendanceLogs.length})` },
                    { key: 'actions', label: 'Membership Actions' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`py-3 text-xs font-semibold tracking-wide transition-all cursor-pointer border-b-2 ${
                      activeTab === tab.key
                        ? 'border-brand text-ink'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-[8px] bg-panel border border-line space-y-3">
                      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold block">
                        Personal Information
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-muted block mb-0.5">Mobile Phone</span>
                          <span className="font-mono text-ink font-medium">{member.mobileNumber}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">WhatsApp Number</span>
                          <span className="font-mono text-ink font-medium">{member.whatsappNumber}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">Father's Name</span>
                          <span className="text-ink">{member.fatherName || 'Not recorded'}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">CNIC #</span>
                          <span className="font-mono text-ink">{member.cnic || 'Not recorded'}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">Gender</span>
                          <span className="text-ink">{member.gender}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">Blood Group</span>
                          <span className="text-ink">{member.bloodGroup || 'Not recorded'}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">Address</span>
                          <span className="text-ink">{member.address || 'Hyderabad, Sindh'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-[8px] bg-panel border border-line space-y-3">
                      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold block">
                        Emergency Contact & Medical Notes
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-muted block mb-0.5">Emergency Contact</span>
                          <span className="text-ink">{member.emergencyContactName || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-muted block mb-0.5">Emergency Phone</span>
                          <span className="font-mono text-ink">{member.emergencyContactPhone || 'None'}</span>
                        </div>
                      </div>
                      {member.medicalNotes && (
                        <div className="mt-2 text-warn text-xs">
                          Medical notes: {member.medicalNotes}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-[8px] bg-panel border border-line space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                          Membership History
                        </span>
                        <span className="text-[10px] text-muted">
                          Original join: {member.registrationDate || member.startDate}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {membershipPeriods.map((period, index) => (
                          <div key={period.id} className="flex items-start gap-2.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5 mt-0.5 text-brand shrink-0" />
                            <div>
                              <span className="text-ink font-semibold">
                                {index === 0 ? 'Joined' : 'Rejoined'}: {period.startDate}
                              </span>
                              {period.endDate && (
                                <span className="text-muted"> · Left: {period.endDate}</span>
                              )}
                              {!period.endDate && index === membershipPeriods.length - 1 && (
                                <span className="text-ok"> · Current membership period</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {history.length > 0 && (
                        <div className="pt-2 border-t border-line space-y-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                            Plan Activity
                          </span>
                          {history.map((entry) => (
                            <div key={entry.id} className="flex justify-between gap-3 text-[10px]">
                              <span className="text-ink">{entry.actionType} · {entry.planName}</span>
                              <span className="font-mono text-muted">{entry.startDate} – {entry.expiryDate}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. BILLING & PAYMENTS TAB */}
                {activeTab === 'billing' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                        Lifetime Payment History
                      </span>
                      {member.balanceDue > 0 ? (
                        <button
                          onClick={() => {
                            setCollectAmount(member.balanceDue);
                            setCollectError(null);
                            setShowCollectFeeModal(true);
                          }}
                          className="px-3 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                        >
                          + Collect Fee
                        </button>
                      ) : (
                        <span className="text-[11px] text-ok">No outstanding balance</span>
                      )}
                    </div>

                    <div className="border border-line rounded-[8px] bg-panel overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-line bg-raised text-muted text-[10px] uppercase tracking-wider">
                            <th className="py-2 px-3 font-semibold">Receipt #</th>
                            <th className="py-2 px-3 font-semibold">Date</th>
                            <th className="py-2 px-3 font-semibold text-right">Amount</th>
                            <th className="py-2 px-3 font-semibold">Method</th>
                            <th className="py-2 px-3 font-semibold">Received By</th>
                            <th className="py-2 px-3 font-semibold text-right">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-muted">
                                No payment receipts found for this member.
                              </td>
                            </tr>
                          ) : (
                            payments.map((p) => (
                              <tr key={p.id} className="h-10 hover:bg-raised/50">
                                <td className="py-2 px-3 font-mono text-ink">{p.receiptNumber}</td>
                                <td className="py-2 px-3 font-mono text-muted">
                                  {p.createdAt ? p.createdAt.split('T')[0] : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-ok tabular-nums">
                                  Rs. {p.amount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 font-mono">{p.paymentMethod}</td>
                                <td className="py-2 px-3 text-muted">{p.receivedBy}</td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    onClick={() => setReceiptToPrint(p)}
                                    className="p-1 text-muted hover:text-ink cursor-pointer"
                                    title="View / Print Receipt"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. ATTENDANCE TAB */}
                {activeTab === 'attendance' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                        Attendance & Turnstile Check-Ins ({attendanceLogs.length} total visits)
                      </span>
                    </div>

                    <div className="border border-line rounded-[8px] bg-panel overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-line bg-raised text-muted text-[10px] uppercase tracking-wider">
                            <th className="py-2 px-3 font-semibold">Date & Time</th>
                            <th className="py-2 px-3 font-semibold">Method</th>
                            <th className="py-2 px-3 font-semibold">Access Status</th>
                            <th className="py-2 px-3 font-semibold">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {attendanceLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-muted">
                                No attendance records logged yet for this member.
                              </td>
                            </tr>
                          ) : (
                            attendanceLogs.map((a) => (
                              <tr key={a.id} className="h-10 hover:bg-raised/50">
                                <td className="py-2 px-3 font-mono text-ink">
                                  {new Date(a.timestamp).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 font-mono text-muted">{a.method}</td>
                                <td className="py-2 px-3">
                                  <span className="status-pill-success">Granted</span>
                                </td>
                                <td className="py-2 px-3 text-muted">{a.notes || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. MEMBERSHIP ACTIONS TAB (RENEW / FREEZE / DELETE) */}
                {activeTab === 'actions' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-[8px] bg-panel border border-line flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-xs text-ink">Renew Membership Plan</h4>
                        <p className="text-[11px] text-muted mt-0.5">
                          Extend validity and apply package fee with optional discount.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowRenewModal(true)}
                        className="px-3.5 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
                      >
                        Renew Plan
                      </button>
                    </div>

                    <div className="p-4 rounded-[8px] bg-panel border border-line flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-xs text-ink">Freeze / Pause Membership</h4>
                        <p className="text-[11px] text-muted mt-0.5">
                          Temporarily suspend access due to medical leave or travel without losing days.
                        </p>
                      </div>
                      {member.status === 'FROZEN' ? (
                        <button
                          onClick={handleResume}
                          className="px-3.5 py-1.5 rounded-[6px] bg-ok hover:bg-[#2E9E74] text-white text-xs font-semibold cursor-pointer"
                        >
                          Resume Membership
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowFreezeModal(true)}
                          className="px-3.5 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-ink text-xs font-semibold cursor-pointer"
                        >
                          Freeze
                        </button>
                      )}
                    </div>

                    <div className="p-4 rounded-[8px] bg-panel border border-bad/40 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-xs text-bad">Mark Member as Left</h4>
                        <p className="text-[11px] text-muted mt-0.5">
                          Close this membership period while keeping the profile, attendance, and payment history.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowLeaveModal(true)}
                        className="px-3.5 py-1.5 rounded-[6px] bg-bad hover:bg-bad-strong text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Mark as Left
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Drawer / Modal: Collect Fee Inside Profile */}
      {showCollectFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Collect Fee — {member.fullName}
              </h3>
              <button onClick={() => setShowCollectFeeModal(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectFeeSubmit} className="space-y-3.5 text-xs">
              {collectError && <p role="alert" className="text-[11px] text-bad">{collectError}</p>}
              <div className="p-3 rounded-[6px] bg-raised border border-line space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">Current Due:</span>
                  <span className="font-mono text-bad font-bold">Rs. {member.balanceDue.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={member.balanceDue}
                  value={collectAmount}
                  onChange={(e) => {
                    setCollectAmount(Number(e.target.value));
                    setCollectError(null);
                  }}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-ink focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Payment Method
                </label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                >
                  <option value="Cash">Cash (Front Desk)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="e.g. Cleared pending dues"
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectFeeModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-raised text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-xs font-bold text-white uppercase tracking-wider"
                >
                  Confirm & Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Renew Membership — {member.fullName}
              </h3>
              <button onClick={() => setShowRenewModal(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-3.5 text-xs">
              {renewError && <p role="alert" className="text-[11px] text-bad">{renewError}</p>}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Select Plan Package
                </label>
                <select
                  value={renewPlanId}
                  onChange={(e) => {
                    setRenewPlanId(e.target.value);
                    const p = renewalPlans.find((pl) => pl.id === e.target.value);
                    if (p) setRenewPaidAmount(p.price + renewalLateFee - renewDiscount);
                  }}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                >
                  {renewalPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Rs. {p.price.toLocaleString()} ({p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} month)
                    </option>
                  ))}
                </select>
              </div>
              {renewalLateFee > 0 && <p className="text-[11px] text-warn">Overdue membership late fee: Rs. 500</p>}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Amount Paid (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={renewPaidAmount}
                    onChange={(e) => setRenewPaidAmount(Number(e.target.value))}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-ink"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Discount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={renewDiscount}
                    onChange={(e) => setRenewDiscount(Number(e.target.value))}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Payment Method
                </label>
                <select
                  value={renewMethod}
                  onChange={(e) => setRenewMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                >
                  <option value="Cash">Cash (Front Desk)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-raised text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-xs font-bold text-white uppercase tracking-wider"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Freeze Membership
            </h3>
            <p className="text-xs text-muted">
              Temporarily pause {member.fullName}'s membership validity.
            </p>
            <form onSubmit={handleFreezeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Reason for Freeze
                </label>
                <input
                  type="text"
                  required
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFreezeModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-raised text-xs text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-bold text-ink"
                >
                  Confirm Freeze
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Mark Member as Left?
            </h3>
            <p className="text-xs text-muted">
              This will record today as the leave date for {member.fullName}. Their profile, roll number, attendance, and payment history will be retained for a future rejoin.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-3 py-1.5 rounded-[6px] bg-raised text-xs text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveMember}
                className="px-4 py-1.5 rounded-[6px] bg-bad hover:bg-bad-strong text-xs font-bold text-white uppercase tracking-wider"
              >
                Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Card */}
      {showPrintCard && (
        <PrintableMemberCard
          member={member}
          onClose={() => setShowPrintCard(false)}
        />
      )}

      {/* Printable Receipt */}
      {receiptToPrint && (
        <PrintableReceipt
          payment={receiptToPrint}
          onClose={() => setReceiptToPrint(null)}
          autoTriggerPrint
        />
      )}
    </>
  );
};
