import React, { useRef, useState } from 'react';
import { CreditCard, Download, ReceiptText, Wallet } from 'lucide-react';
import { db } from '../../db/storage';
import { Member, PaymentMethod } from '../../types';
import { ExportService } from '../../services/exportService';

export const MemberFeeLedger: React.FC = () => {
  const [, setRefreshKey] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState(() => db.getMembers()[0]?.id || '');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const paymentRequestKey = useRef('');

  React.useEffect(() => db.subscribe(() => setRefreshKey((key) => key + 1)), []);

  const members = db.getMembers();
  const member = members.find((candidate) => candidate.id === selectedMemberId);
  const ledger = member ? db.getMemberFeeLedger(member.id) : [];
  let runningBalance = 0;
  const rows = ledger.map((entry) => {
    runningBalance += entry.type === 'CHARGE' ? entry.amount : -entry.amount;
    return { ...entry, remainingBalance: runningBalance };
  });

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
      db.recordPayment({
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to record payment.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="flex-1 p-5 space-y-4 text-[#ECEAE6]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold">Member Fee Ledger</h2>
          <p className="mt-1 text-xs text-[#8B909A]">Charges, payments, and running balances from the member ledger.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ledger-member" className="text-[11px] text-[#8B909A]">Member</label>
          <select
            id="ledger-member"
            value={selectedMemberId}
            onChange={(event) => setSelectedMemberId(event.target.value)}
            className="min-w-56 rounded-[6px] border border-[#262A30] bg-[#15171A] px-3 py-2 text-xs text-[#ECEAE6]"
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
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#262A30] bg-[#15171A] p-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold">{member.fullName}</h3>
              <p className="text-xs text-[#8B909A]">{member.mobileNumber} · Joined {member.registrationDate}</p>
              <p className="font-mono text-[11px] text-[#8B909A]">{member.rollNumber}</p>
            </div>
            <div className={`rounded-[8px] border px-4 py-2 text-right ${
              member.balanceDue > 0
                ? 'border-[#E5484D]/40 bg-[#E5484D]/10 text-[#E5484D]'
                : 'border-[#3DB88B]/40 bg-[#3DB88B]/10 text-[#3DB88B]'
            }`}>
              <span className="block text-[10px] font-semibold uppercase tracking-wider">
                {member.balanceDue > 0 ? 'Outstanding Due' : member.balanceDue < 0 ? 'Member Credit' : 'Current Balance'}
              </span>
              <strong className="font-mono text-xl tabular-nums">
                Rs. {Math.abs(member.balanceDue).toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#262A30] bg-[#15171A]">
            <div className="flex items-center justify-between border-b border-[#262A30] p-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <ReceiptText className="h-4 w-4 text-[#8B909A]" /> Transaction History
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ExportService.exportMemberFeeLedgerToCsv(member, ledger)}
                  className="flex items-center gap-1.5 rounded-[6px] border border-[#262A30] px-3 py-2 text-xs font-bold text-[#8B909A] hover:text-[#ECEAE6]"
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
                  className="flex items-center gap-1.5 rounded-[6px] bg-[#D9383A] px-3 py-2 text-xs font-bold text-white hover:bg-[#C92A2C]"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Collect Payment
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="bg-[#1C1F23] text-[10px] uppercase tracking-wider text-[#8B909A]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount Paid / Charged</th>
                    <th className="p-3 text-right">Remaining Balance</th>
                    <th className="p-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A30]">
                  {rows.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap p-3 font-mono text-[#8B909A]">{entry.date}</td>
                      <td className="p-3">{entry.description}</td>
                      <td className={`p-3 font-bold ${entry.type === 'PAYMENT' ? 'text-[#3DB88B]' : 'text-[#E5484D]'}`}>
                        {entry.type === 'PAYMENT' ? 'CREDIT · PAYMENT' : 'DEBIT · CHARGE'}
                        {entry.paymentMethod && <span className="ml-1 font-normal text-[#8B909A]">({entry.paymentMethod})</span>}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${entry.type === 'PAYMENT' ? 'text-[#3DB88B]' : 'text-[#E5484D]'}`}>
                        {entry.type === 'PAYMENT' ? '−' : '+'} Rs. {entry.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {entry.remainingBalance < 0 ? 'Credit ' : ''}Rs. {Math.abs(entry.remainingBalance).toLocaleString()}
                      </td>
                      <td className="p-3 text-[#8B909A]">{entry.recordedBy}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-[#8B909A]">No fee ledger transactions recorded for this member.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showPaymentForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <form onSubmit={handleCollectPayment} className="w-full max-w-md space-y-4 rounded-[8px] border border-[#262A30] bg-[#15171A] p-5 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[#3DB88B]" />
                  <h3 className="font-condensed text-base font-bold uppercase">Collect Payment</h3>
                </div>
                <p className="text-xs text-[#8B909A]">{member.fullName} · Balance: Rs. {Math.abs(member.balanceDue).toLocaleString()}{member.balanceDue < 0 ? ' credit' : ''}</p>
                {error && <p role="alert" className="text-xs text-[#E5484D]">{error}</p>}
                <div className="space-y-3">
                  <label className="block text-[11px] text-[#8B909A]">
                    Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-sm text-[#ECEAE6]"
                    />
                  </label>
                  <label className="block text-[11px] text-[#8B909A]">
                    Payment Method
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]"
                    >
                      {(['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Card'] as PaymentMethod[]).map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] text-[#8B909A]">
                    Payment Date
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]"
                    />
                  </label>
                  <label className="block text-[11px] text-[#8B909A]">
                    Notes
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={2}
                      className="mt-1 w-full resize-y rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowPaymentForm(false)} className="rounded-[6px] border border-[#262A30] px-3 py-2 text-xs text-[#8B909A]">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="rounded-[6px] bg-[#3DB88B] px-3 py-2 text-xs font-bold text-[#0D0E10] disabled:opacity-50">
                    {submitting ? 'Recording…' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[8px] border border-[#262A30] bg-[#15171A] p-10 text-center text-sm text-[#8B909A]">
          No member selected.
        </div>
      )}
    </section>
  );
};
