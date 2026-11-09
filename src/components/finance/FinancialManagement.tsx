import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  Printer,
  Wallet,
  AlertTriangle,
  Send,
  X,
  Search,
} from 'lucide-react';
import { db } from '../../db/storage';
import { PaymentRecord, PaymentMethod, Member } from '../../types';
import { ExportService } from '../../services/exportService';
import { WhatsAppService } from '../../services/whatsappService';
import { PrintableReceipt } from './PrintableReceipt';

interface FinancialManagementProps {
  initialOpenCollectPayment?: boolean;
  onClearInitialPayment?: () => void;
}

export const FinancialManagement: React.FC<FinancialManagementProps> = ({
  initialOpenCollectPayment,
  onClearInitialPayment,
}) => {
  const [activeTab, setActiveTab] = useState<'payments' | 'dues' | 'cashbook'>('payments');
  const [showCollectDrawer, setShowCollectDrawer] = useState(initialOpenCollectPayment || false);
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentRecord | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [, setRefreshKey] = useState(0);

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (initialOpenCollectPayment) {
      setShowCollectDrawer(true);
      if (onClearInitialPayment) onClearInitialPayment();
    }
  }, [initialOpenCollectPayment, onClearInitialPayment]);

  const payments = db.getPayments();
  const members = db.getMembers();
  const membersWithDues = members.filter((member) => member.balanceDue > 0);
  const settings = db.getSettings();

  const todayStr = new Date().toISOString().split('T')[0];

  // Totals
  const todayPayments = payments.filter((p) => p.createdAt.startsWith(todayStr));
  const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  const overdueMembers = members.filter((m) => m.balanceDue > 0);
  const totalOutstanding = overdueMembers.reduce((sum, m) => sum + m.balanceDue, 0);

  // Form states for Collecting Payment
  const [selectedMemberId, setSelectedMemberId] = useState(membersWithDues[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<number>(membersWithDues[0]?.balanceDue || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentType, setPaymentType] = useState<PaymentRecord['paymentType']>('MEMBERSHIP');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const handleMemberSelect = (id: string) => {
    setSelectedMemberId(id);
    const m = membersWithDues.find((x) => x.id === id);
    setPaymentAmount(m?.balanceDue || 0);
    setPaymentError(null);
  };

  const handleOpenCollectForMember = (member: Member) => {
    const memberWithDues = membersWithDues.find((candidate) => candidate.id === member.id);
    setSelectedMemberId(memberWithDues?.id || '');
    setPaymentAmount(memberWithDues?.balanceDue || 0);
    setPaymentError(null);
    setShowCollectDrawer(true);
  };

  const handleCollectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setPaymentError('Enter a valid amount greater than zero.');
      return;
    }

    let newPayment: PaymentRecord;
    try {
      newPayment = db.recordPayment({
        memberId: selectedMember.id,
        rollNumber: selectedMember.rollNumber,
        memberName: selectedMember.fullName,
        amount: paymentAmount,
        paymentMethod,
        paymentType,
        notes: paymentNotes || undefined,
      });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to record the payment.');
      return;
    }

    setShowCollectDrawer(false);
    setReceiptToPrint(newPayment);
    reload();
  };

  // Cash breakdown
  const methods = ['Cash'] as const;
  const todayBreakdown = methods.map((m) => {
    const sum = todayPayments
      .filter((p) => p.paymentMethod === m)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { method: m, total: sum };
  });

  const filteredPayments = payments.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.receiptNumber.toLowerCase().includes(q) ||
      p.memberName.toLowerCase().includes(q) ||
      p.rollNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-app text-ink">
      {/* Top Header & Actions */}
      <div className="p-4 border-b border-line bg-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-ink">
              Payments & Financial Register
            </h2>
            <span className="font-mono text-xs text-ok bg-raised px-2 py-0.5 rounded-[4px] border border-line">
              Today: Rs. {todayRevenue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Collect member dues, issue printable receipts, manage drawer cash, and track balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => ExportService.exportPaymentsToCsv(payments)}
            className="px-3 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-muted hover:text-ink transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowCollectDrawer(true)}
            className="px-3.5 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-brand"
          >
            <CreditCard className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Collect Payment</span>
          </button>
        </div>
      </div>

      {/* Connected Financial Strip */}
      <div className="p-5 pb-0 shrink-0">
        <div className="border border-line rounded-[8px] bg-panel grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line overflow-hidden">
          <div className="p-4">
            <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
              Today's Shift Collections
            </span>
            <div className="font-condensed text-2xl font-bold text-ok tabular-nums mt-1">
              {settings.currency} {todayRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-muted mt-1 block">
              {todayPayments.length} receipts issued at front desk
            </span>
          </div>

          <div className="p-4">
            <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
              Outstanding Member Dues
            </span>
            <div className="font-condensed text-2xl font-bold text-bad tabular-nums mt-1">
              {settings.currency} {totalOutstanding.toLocaleString()}
            </div>
            <span className="text-[10px] text-bad font-medium mt-1 block">
              {overdueMembers.length} members with pending balance
            </span>
          </div>

          <div className="p-4">
            <span className="text-[11px] uppercase tracking-[0.04em] text-muted font-semibold block">
              Physical Cash in Drawer
            </span>
            <div className="font-condensed text-2xl font-bold text-ink tabular-nums mt-1">
              {settings.currency} {(todayBreakdown.find((b) => b.method === 'Cash')?.total || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-muted mt-1 block">
              Counter register physical cash
            </span>
          </div>
        </div>
      </div>

      {/* Underline Tabs Header */}
      <div className="px-5 pt-4 border-b border-line bg-app flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-2.5 text-xs font-semibold tracking-wide transition-all cursor-pointer border-b-2 ${
              activeTab === 'payments'
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Receipts Ledger ({payments.length})
          </button>

          <button
            onClick={() => setActiveTab('dues')}
            className={`py-2.5 text-xs font-semibold tracking-wide transition-all cursor-pointer border-b-2 ${
              activeTab === 'dues'
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Pending Dues ({overdueMembers.length})
          </button>

          <button
            onClick={() => setActiveTab('cashbook')}
            className={`py-2.5 text-xs font-semibold tracking-wide transition-all cursor-pointer border-b-2 ${
              activeTab === 'cashbook'
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Drawer Breakdown
          </button>
        </div>

        {activeTab === 'payments' && (
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter receipts..."
              className="bg-panel border border-line rounded-[6px] pl-8 pr-3 py-1 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Tab 1: Receipts Ledger */}
        {activeTab === 'payments' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-raised border-b border-line text-muted text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Receipt #</th>
                <th className="py-2.5 px-4 font-semibold">Date & Time</th>
                <th className="py-2.5 px-4 font-semibold">Roll #</th>
                <th className="py-2.5 px-4 font-semibold">Member Name</th>
                <th className="py-2.5 px-4 font-semibold text-right">Amount (PKR)</th>
                <th className="py-2.5 px-4 font-semibold">Payment Mode</th>
                <th className="py-2.5 px-4 font-semibold">Received By</th>
                <th className="py-2.5 px-4 font-semibold text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No fee payments recorded. Click "Collect Payment" to issue a receipt.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="h-11 hover:bg-raised/60 transition-colors">
                    <td className="py-2 px-4 font-mono font-bold text-ink">{p.receiptNumber}</td>
                    <td className="py-2 px-4 font-mono text-muted text-[11px]">
                      {p.createdAt ? p.createdAt.split('T')[0] : '—'}
                    </td>
                    <td className="py-2 px-4 font-mono text-muted">{p.rollNumber}</td>
                    <td className="py-2 px-4 font-medium text-ink">{p.memberName}</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-ok tabular-nums">
                      Rs. {p.amount.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-mono">{p.paymentMethod}</td>
                    <td className="py-2 px-4 text-muted">{p.receivedBy}</td>
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => setReceiptToPrint(p)}
                        className="px-2 py-1 rounded-[4px] bg-raised hover:bg-hover border border-line text-[11px] text-ink cursor-pointer"
                        title="Print 80mm receipt"
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 2: Pending Dues */}
        {activeTab === 'dues' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-raised border-b border-line text-muted text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Roll #</th>
                <th className="py-2.5 px-4 font-semibold">Member Name</th>
                <th className="py-2.5 px-4 font-semibold">Plan</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Package</th>
                <th className="py-2.5 px-4 font-semibold text-right">Already Paid</th>
                <th className="py-2.5 px-4 font-semibold text-right">Outstanding Due</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {overdueMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    All registered members have zero outstanding dues.
                  </td>
                </tr>
              ) : (
                overdueMembers.map((m) => (
                  <tr key={m.id} className="h-11 hover:bg-raised/60 transition-colors">
                    <td className="py-2 px-4 font-mono font-bold text-ink">{m.rollNumber}</td>
                    <td className="py-2 px-4 font-medium text-ink">{m.fullName}</td>
                    <td className="py-2 px-4 text-muted">{m.planName}</td>
                    <td className="py-2 px-4 text-right font-mono text-muted tabular-nums">
                      Rs. {m.totalFee.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-ok tabular-nums">
                      Rs. {m.paidAmount.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-bad tabular-nums">
                      Rs. {m.balanceDue.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => handleOpenCollectForMember(m)}
                        className="px-2.5 py-1 rounded-[4px] bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
                      >
                        Collect Due
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 3: Drawer Breakdown */}
        {activeTab === 'cashbook' && (
          <div className="p-5 max-w-2xl space-y-4">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Today's Shift Drawer Method Breakdown
            </h3>
            <div className="border border-line rounded-[8px] bg-panel divide-y divide-line overflow-hidden">
              {todayBreakdown.map((b) => (
                <div key={b.method} className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">{b.method}</span>
                  <span className="font-mono font-bold text-ink tabular-nums">
                    Rs. {b.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Drawer: Collect Fee (480px Right Side) */}
      {showCollectDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="w-[480px] max-w-full bg-raised border-l border-line h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-line flex items-center justify-between bg-panel">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-ink">
                Collect Member Payment & Issue Receipt
              </h3>
              <button onClick={() => setShowCollectDrawer(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Select Member With Outstanding Dues *
                </label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  className="w-full bg-panel border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                >
                  <option value="" disabled>
                    {membersWithDues.length > 0 ? 'Select member...' : 'No outstanding member dues'}
                  </option>
                  {membersWithDues.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.rollNumber} — {m.fullName} ({m.planName}) · Due: Rs. {m.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMember && (
                <div className="p-3.5 rounded-[6px] bg-panel border border-line space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Plan:</span>
                    <span className="font-semibold text-ink">{selectedMember.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Total Package:</span>
                    <span className="font-mono text-ink">Rs. {selectedMember.totalFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Already Paid:</span>
                    <span className="font-mono text-ok">Rs. {selectedMember.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1 font-bold">
                    <span className="text-ink">Balance Due:</span>
                    <span className="font-mono text-bad">Rs. {selectedMember.balanceDue.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedMember?.balanceDue}
                  aria-label="Amount Received (PKR)"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(Number(e.target.value));
                    setPaymentError(null);
                  }}
                  className="w-full bg-panel border border-line rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-ink focus:ring-2 focus:ring-brand focus:outline-none"
                />
                {paymentError && <p role="alert" className="mt-1 text-[11px] text-bad">{paymentError}</p>}
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Cash'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 rounded-[6px] border text-[11px] font-semibold text-center cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-brand border-brand text-white'
                          : 'bg-panel border-line text-muted'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Notes / Transaction Reference
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Counter collection"
                  className="w-full bg-panel border border-line rounded-[6px] px-3 py-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectDrawer(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-panel text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-xs font-bold text-white uppercase tracking-wider"
                >
                  Confirm & Issue Receipt
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
