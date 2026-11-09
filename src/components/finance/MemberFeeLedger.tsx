import React, { useRef, useState } from 'react';
import { CreditCard, Download, Printer, ReceiptText, Wallet } from 'lucide-react';
import { db } from '../../db/storage';
import { Member, PaymentMethod } from '../../types';
import { ExportService } from '../../services/exportService';
import { printDocument } from '../../services/printService';
import { PrintableReceipt } from './PrintableReceipt';

interface MemberFeeLedgerProps {
  initialOpenCollectPayment?: boolean;
  initialMemberId?: string;
  onClearInitialPayment?: () => void;
}

export const MemberFeeLedger: React.FC<MemberFeeLedgerProps> = ({
  initialOpenCollectPayment,
  initialMemberId,
  onClearInitialPayment,
}) => {
  const [, setRefreshKey] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState(() => initialMemberId || db.getMembers()[0]?.id || '');
  const [showPaymentForm, setShowPaymentForm] = useState(initialOpenCollectPayment || false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<import('../../types').PaymentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const submitLock = useRef(false);
  const paymentRequestKey = useRef('');

  React.useEffect(() => db.subscribe(() => setRefreshKey((key) => key + 1)), []);
  React.useEffect(() => {
    if (!initialOpenCollectPayment) return;
    setSelectedMemberId(initialMemberId || db.getMembers()[0]?.id || '');
    setShowPaymentForm(true);
    onClearInitialPayment?.();
  }, [initialOpenCollectPayment, initialMemberId, onClearInitialPayment]);

  const members = db.getMembers();
  const member = members.find((candidate) => candidate.id === selectedMemberId);
  const ledger = member ? db.getMemberFeeLedger(member.id) : [];
  const paymentHistory = member
    ? db.getPayments().filter((payment) => payment.memberId === member.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  let runningBalance = 0;
  const rows = ledger.map((entry) => {
    runningBalance += entry.type === 'CHARGE' ? entry.amount : -entry.amount;
    return { ...entry, remainingBalance: runningBalance };
  });

  const monthOf = (entry: { billingMonth?: string; date: string }) =>
    entry.billingMonth || entry.date.slice(0, 7);

  const monthOrder = Array.from(new Set(rows.map((entry) => monthOf(entry)))).sort();

  const monthSummary = monthOrder.map((month) => {
    const monthRows = rows.filter((entry) => monthOf(entry) === month);
    const charges = monthRows
      .filter((entry) => entry.type === 'CHARGE')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const payments = monthRows
      .filter((entry) => entry.type === 'PAYMENT')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const closing = monthRows[monthRows.length - 1]?.remainingBalance ?? 0;
    return { month, charges, payments, closing, count: monthRows.length };
  }).reverse();

  const visibleRows = monthFilter === 'ALL'
    ? rows
    : rows.filter((entry) => monthOf(entry) === monthFilter);

  const ledgerGroups = monthOrder
    .map((month) => {
      const monthRows = visibleRows.filter((entry) => monthOf(entry) === month);
      return {
        month,
        rows: monthRows,
        charges: monthRows.filter((entry) => entry.type === 'CHARGE').reduce((sum, entry) => sum + entry.amount, 0),
        payments: monthRows.filter((entry) => entry.type === 'PAYMENT').reduce((sum, entry) => sum + entry.amount, 0),
      };
    })
    .filter((group) => group.rows.length > 0);

  const visiblePaymentHistory = monthFilter === 'ALL'
    ? paymentHistory
    : paymentHistory.filter((payment) =>
        (payment.billingMonth || payment.paymentDate || payment.createdAt).slice(0, 7) === monthFilter);

  const formatMonth = (month: string) => {
    const parsed = new Date(`${month}-01T00:00:00Z`);
    return Number.isNaN(parsed.getTime())
      ? month
      : parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  const handleCollectPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!member || submitLock.current) return;
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const payment = db.recordPayment({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        amount: amountValue,
        paymentMethod,
        paymentType: 'MEMBERSHIP',
        billingMonth: paymentDate.slice(0, 7),
        notes: notes.trim() || undefined,
      }, paymentDate, paymentRequestKey.current);
      setAmount('');
      setNotes('');
      setShowPaymentForm(false);
      setReceiptToPrint(payment);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record payment.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="flex-1 p-3 sm:p-5 space-y-4 text-ink">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold">Member Fee Record</h2>
          <p className="mt-1 text-xs text-muted">Charges, payments, and running balances from the member ledger.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ledger-member" className="text-[11px] text-muted">Member</label>
          <select
            id="ledger-member"
            value={selectedMemberId}
            onChange={(event) => {
              setSelectedMemberId(event.target.value);
              setMonthFilter('ALL');
            }}
            className="min-w-56 rounded-[6px] border border-line bg-panel px-3 py-2 text-xs text-ink"
          >
            {members.length === 0 && <option value="">No members enrolled</option>}
            {members.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.rollNumber} — {candidate.fullName}</option>
            ))}
          </select>
        </div>
      </div>

      {member ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-line bg-panel p-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold">{member.fullName}</h3>
              <p className="text-xs text-muted">{member.mobileNumber} · Joined {member.registrationDate}</p>
              <p className="font-mono text-[11px] text-muted">{member.rollNumber}</p>
            </div>
            <div className={`rounded-[8px] border px-4 py-2 text-right ${
              member.balanceDue > 0
                ? 'border-bad/40 bg-bad/10 text-bad'
                : 'border-ok/40 bg-ok/10 text-ok'
            }`}>
              <span className="block text-[10px] font-semibold uppercase tracking-wider">
                {member.balanceDue > 0 ? 'Outstanding Due' : member.balanceDue < 0 ? 'Member Credit' : 'Current Balance'}
              </span>
              <strong className="font-mono text-xl tabular-nums">
                Rs. {Math.abs(member.balanceDue).toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-line bg-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider">Month-wise Ledger</h3>
              <div className="flex items-center gap-2">
                <label htmlFor="ledger-month" className="text-[11px] text-muted">Month</label>
                <select
                  id="ledger-month"
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                  className="rounded-[6px] border border-line bg-app px-2.5 py-1.5 text-[11px] text-ink"
                >
                  <option value="ALL">All months</option>
                  {monthSummary.map((summary) => (
                    <option key={summary.month} value={summary.month}>{formatMonth(summary.month)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-raised text-[10px] uppercase tracking-wider text-muted"><tr>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Charged</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Net</th>
                  <th className="p-3 text-right">Closing Balance</th>
                  <th className="p-3 text-center">Entries</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {monthSummary.map((summary) => {
                    const net = summary.charges - summary.payments;
                    return (
                      <tr
                        key={summary.month}
                        onClick={() => setMonthFilter(monthFilter === summary.month ? 'ALL' : summary.month)}
                        className={`cursor-pointer transition-colors hover:bg-raised ${monthFilter === summary.month ? 'bg-raised' : ''}`}
                      >
                        <td className="p-3 font-semibold text-ink">{formatMonth(summary.month)}</td>
                        <td className="p-3 text-right font-mono text-bad">Rs. {summary.charges.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-ok">Rs. {summary.payments.toLocaleString()}</td>
                        <td className={`p-3 text-right font-mono font-bold ${net > 0 ? 'text-bad' : 'text-ok'}`}>
                          {net > 0 ? '+' : net < 0 ? '−' : ''} Rs. {Math.abs(net).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-ink">
                          {summary.closing < 0 ? 'Credit ' : ''}Rs. {Math.abs(summary.closing).toLocaleString()}
                        </td>
                        <td className="p-3 text-center text-muted">{summary.count}</td>
                      </tr>
                    );
                  })}
                  {monthSummary.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted">No monthly ledger entries yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-line bg-panel">
            <div className="border-b border-line p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Payment History {monthFilter !== 'ALL' && <span className="ml-1 text-[10px] font-normal text-muted">· {formatMonth(monthFilter)}</span>}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-raised text-[10px] uppercase tracking-wider text-muted"><tr>
                  <th className="p-3">Payment Date</th><th className="p-3">Membership Month</th><th className="p-3 text-right">Fee</th><th className="p-3 text-right">Late Fee</th><th className="p-3 text-right">Total Paid</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Receipt #</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {visiblePaymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap p-3 font-mono text-muted">{payment.paymentDate || payment.createdAt.slice(0, 10)}</td>
                      <td className="p-3">{payment.billingMonth || '—'}</td>
                      <td className="p-3 text-right font-mono">Rs. {Math.max(0, payment.amount - (payment.lateFee || 0)).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">Rs. {(payment.lateFee || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold">Rs. {payment.amount.toLocaleString()}</td>
                      <td className="p-3">{payment.paymentMethod}</td>
                      <td className="p-3">{payment.paymentStatus || 'Recorded'}</td>
                      <td className="p-3 font-mono text-muted">{payment.receiptNumber}</td>
                    </tr>
                  ))}
                  {visiblePaymentHistory.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted">
                    {paymentHistory.length === 0 ? 'No payment records.' : `No payments recorded for ${formatMonth(monthFilter)}.`}
                  </td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line p-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <ReceiptText className="h-4 w-4 text-muted" /> Transaction History
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void printDocument('fee-record')}
                  className="flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-2 text-xs font-bold text-muted hover:text-ink"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Fee Record
                </button>
                <button
                  type="button"
                  onClick={() => ExportService.exportMemberFeeLedgerToCsv(member, ledger)}
                  className="flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-2 text-xs font-bold text-muted hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPaymentDate(new Date().toISOString().split('T')[0]);
                    paymentRequestKey.current = `ledger_${member.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                    setShowPaymentForm(true);
                  }}
                  className="flex items-center gap-1.5 rounded-[6px] bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-strong"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Collect Payment
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="bg-raised text-[10px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount Paid / Charged</th>
                    <th className="p-3 text-right">Remaining Balance</th>
                    <th className="p-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ledgerGroups.map((group) => (
                    <React.Fragment key={group.month}>
                      <tr className="bg-raised/70">
                        <td colSpan={6} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                          {formatMonth(group.month)} · Charged Rs. {group.charges.toLocaleString()} · Paid Rs. {group.payments.toLocaleString()}
                        </td>
                      </tr>
                      {group.rows.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap p-3 font-mono text-muted">{entry.date}</td>
                      <td className="p-3">{entry.description}</td>
                      <td className={`p-3 font-bold ${entry.type === 'PAYMENT' ? 'text-ok' : 'text-bad'}`}>
                        {entry.type === 'PAYMENT' ? 'CREDIT · PAYMENT' : 'DEBIT · CHARGE'}
                        {entry.paymentMethod && <span className="ml-1 font-normal text-muted">({entry.paymentMethod})</span>}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${entry.type === 'PAYMENT' ? 'text-ok' : 'text-bad'}`}>
                        {entry.type === 'PAYMENT' ? '−' : '+'} Rs. {entry.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {entry.remainingBalance < 0 ? 'Credit ' : ''}Rs. {Math.abs(entry.remainingBalance).toLocaleString()}
                      </td>
                      <td className="p-3 text-muted">{entry.recordedBy}</td>
                    </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted">
                      {rows.length === 0
                        ? 'No fee ledger transactions recorded for this member.'
                        : `No ledger entries for ${formatMonth(monthFilter)}.`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="print-fee-record" aria-hidden="true">
            <header>
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt={db.getSettings().gymName || 'THE GYM TOWN'}
                style={{ height: '14mm', margin: '0 auto 3mm' }}
              />
              <h1>{db.getSettings().gymName || 'THE GYM TOWN'}</h1>
              <p>Member Fee Record</p>
              <p>{member.fullName} · {member.rollNumber} · {member.mobileNumber}</p>
            </header>
            <table>
              <thead><tr><th>Date</th><th>Membership Month</th><th>Fee</th><th>Late Fee</th><th>Total Paid</th><th>Method</th><th>Status</th><th>Receipt #</th></tr></thead>
              <tbody>{paymentHistory.map((payment) => <tr key={payment.id}>
                <td>{payment.paymentDate || payment.createdAt.slice(0, 10)}</td><td>{payment.billingMonth || '—'}</td>
                <td>Rs. {Math.max(0, payment.amount - (payment.lateFee || 0)).toLocaleString()}</td><td>Rs. {(payment.lateFee || 0).toLocaleString()}</td>
                <td>Rs. {payment.amount.toLocaleString()}</td><td>{payment.paymentMethod}</td><td>{payment.paymentStatus || 'Recorded'}</td><td>{payment.receiptNumber}</td>
              </tr>)}</tbody>
              <tfoot><tr><td colSpan={4}>Total collected</td><td>Rs. {paymentHistory.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString()}</td><td colSpan={3}></td></tr></tfoot>
            </table>
          </div>

          {showPaymentForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <form onSubmit={handleCollectPayment} className="w-full max-w-md space-y-4 rounded-[8px] border border-line bg-panel p-5 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-ok" />
                  <h3 className="font-condensed text-base font-bold uppercase">Collect Payment</h3>
                </div>
                <p className="text-xs text-muted">{member.fullName} · Balance: Rs. {Math.abs(member.balanceDue).toLocaleString()}{member.balanceDue < 0 ? ' credit' : ''}</p>
                {error && <p role="alert" className="text-xs text-bad">{error}</p>}
                <div className="space-y-3">
                  <label className="block text-[11px] text-muted">
                    Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="block text-[11px] text-muted">
                    Payment Method
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink"
                    >
                      {(['Cash'] as PaymentMethod[]).map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] text-muted">
                    Payment Date
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink"
                    />
                  </label>
                  <label className="block text-[11px] text-muted">
                    Notes
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={2}
                      className="mt-1 w-full resize-y rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowPaymentForm(false)} className="rounded-[6px] border border-line px-3 py-2 text-xs text-muted">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="rounded-[6px] bg-ok px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {submitting ? 'Recording…' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[8px] border border-line bg-panel p-10 text-center text-sm text-muted">
          No member selected.
        </div>
      )}
      {receiptToPrint && <PrintableReceipt payment={receiptToPrint} onClose={() => setReceiptToPrint(null)} />}
    </section>
  );
};
