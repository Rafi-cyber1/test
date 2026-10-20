import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  CheckCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  Send,
  Printer,
  UserCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { addCalendarMonths, db } from '../../db/storage';
import { Member, MembershipPlan, PaymentMethod, PaymentRecord } from '../../types';
import { WhatsAppService } from '../../services/whatsappService';
import { PrintableReceipt } from '../finance/PrintableReceipt';

interface MonthlyFeeRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRollNumber?: string;
  onRenewSuccess?: () => void;
}

export const MonthlyFeeRenewalModal: React.FC<MonthlyFeeRenewalModalProps> = ({
  isOpen,
  onClose,
  initialRollNumber,
  onRenewSuccess,
}) => {
  const [uniqueIdInput, setUniqueIdInput] = useState(initialRollNumber || '');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Renewal Parameters
  const activePlans = db.getPlans().filter((p) => p.isActive);
  const plans = activePlans.filter((p) => !p.id.startsWith('plan_admission'));
  const regularPlan = plans.find((p) => p.id === 'plan_monthly') || plans[0];

  const [selectedPlanId, setSelectedPlanId] = useState(regularPlan?.id || '');
  const [amountPaid, setAmountPaid] = useState<number>(2000);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentRecord | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  // If initial roll number provided, lookup immediately
  useEffect(() => {
    if (initialRollNumber) {
      setUniqueIdInput(initialRollNumber);
      const m = db.getMemberByRollNumber(initialRollNumber);
      if (m) {
        setSelectedMember(m);
      }
    }
  }, [initialRollNumber]);

  useEffect(() => {
    if (isOpen) setIsSuccess(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLookupMember = (queryToUse?: string) => {
    setSearchError(null);
    const q = (queryToUse !== undefined ? queryToUse : uniqueIdInput).trim();
    if (!q) {
      setSearchError('Please enter a Unique ID (e.g. the-gym-town-01)');
      setSelectedMember(null);
      return;
    }

    const member = db.getMemberByRollNumber(q);
    if (!member) {
      // Also try name or phone match
      const all = db.getMembers();
      const byNameOrPhone = all.find(
        (m) =>
          m.fullName.toLowerCase().includes(q.toLowerCase()) ||
          m.mobileNumber.replace(/[^\d]/g, '').endsWith(q.replace(/[^\d]/g, ''))
      );

      if (byNameOrPhone) {
        setSelectedMember(byNameOrPhone);
        setUniqueIdInput(byNameOrPhone.rollNumber);
        initFormForMember(byNameOrPhone);
        return;
      }

      setSearchError(`No member found for ID "${q}". Example format: the-gym-town-01`);
      setSelectedMember(null);
      return;
    }

    setSelectedMember(member);
    setUniqueIdInput(member.rollNumber);
    initFormForMember(member);
  };

  const initFormForMember = (member: Member) => {
    const renewalPlanId = member.planId === 'plan_admission_advance'
      ? 'plan_monthly'
      : member.planId === 'plan_admission_muscle'
        ? 'plan_monthly_muscle'
        : member.planId;
    const defaultRenewalPlan = plans.find((p) => p.id === renewalPlanId) || {
          id: member.planId,
          name: member.planName,
          durationDays: 30,
          durationMonths: 1,
          price: member.monthlyFee ?? regularPlan?.price ?? 2000,
          description: 'Member-specific monthly fee',
          isActive: true,
          trainingType: 'CUSTOM' as const,
        };
    setSelectedPlanId(defaultRenewalPlan.id);
    setAmountPaid(defaultRenewalPlan.price);
    setDiscount(0);
    setPaymentMethod('Cash');
    setNotes(`Monthly fee renewal (${defaultRenewalPlan.name})`);
  };

  const customMemberPlan = selectedMember
    && !selectedMember.planId.startsWith('plan_admission')
    && !plans.some((p) => p.id === selectedMember.planId)
    ? {
        id: selectedMember.planId,
        name: selectedMember.planName,
        durationDays: 30,
        durationMonths: 1,
        price: selectedMember.monthlyFee ?? regularPlan?.price ?? 2000,
        description: 'Member-specific monthly fee',
        isActive: true,
        trainingType: 'CUSTOM' as const,
      }
    : undefined;
  const renewalPlans = customMemberPlan ? [...plans, customMemberPlan] : plans;
  const activePlan = renewalPlans.find((p) => p.id === selectedPlanId) || regularPlan;

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const p = renewalPlans.find((x) => x.id === planId);
    if (p) {
      setAmountPaid(Math.max(0, p.price - discount));
    }
  };

  // Preview new expiry date
  const computeProjectedExpiry = (): string => {
    if (!selectedMember || !activePlan) return '';
    const todayStr = new Date().toISOString().split('T')[0];
    let baseDate = todayStr;

    // If current membership has not yet expired, extend from existing expiry date
    if (selectedMember.expiryDate > todayStr) {
      baseDate = selectedMember.expiryDate;
    }

    return addCalendarMonths(baseDate, activePlan.durationMonths || Math.max(1, Math.round(activePlan.durationDays / 30)));
  };

  const handleSubmitRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !activePlan || isSuccess) return;
    setRenewalError(null);
    try {
      const success = db.renewMembership(
        selectedMember.id,
        activePlan.id,
        Number(amountPaid),
        paymentMethod,
        Number(discount)
      );
      if (!success) throw new Error('Unable to renew this membership.');
      setIsSuccess(true);
      const latestPayment = db.getPayments().find((payment) => payment.memberId === selectedMember.id);

      if (latestPayment) {
        setReceiptToPrint(latestPayment);
      }

      if (onRenewSuccess) onRenewSuccess();
    } catch (error) {
      setRenewalError(error instanceof Error ? error.message : 'Unable to renew this membership.');
    }
  };

  const handleSendWhatsAppConfirmation = () => {
    if (!selectedMember || !activePlan) return;
    const projectedExpiry = computeProjectedExpiry();
    const text = `*THE GYM TOWN — MONTHLY FEE RENEWAL CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━
*Unique ID:* ${selectedMember.rollNumber}
*Member Name:* ${selectedMember.fullName}
*Package:* ${activePlan.name}
*Amount Received:* Rs. ${(Number(amountPaid) || 0).toLocaleString()} (${paymentMethod})
*New Valid Till:* ${projectedExpiry}

Thank you for renewing your gym membership at THE GYM TOWN! Stay consistent! 💪`;

    const url = WhatsAppService.getClickToChatUrl(
      selectedMember.whatsappNumber || selectedMember.mobileNumber,
      text
    );
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-[2px]">
        <div className="w-[520px] max-w-full bg-[#1C1F23] border border-[#262A30] rounded-[8px] overflow-hidden flex flex-col shadow-2xl max-h-[92vh]">
          {/* Header */}
          <div className="p-4 border-b border-[#262A30] bg-[#15171A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[6px] bg-[#D9383A]/10 border border-[#D9383A]/30 flex items-center justify-center text-[#D9383A]">
                <RefreshCw className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6]">
                  Monthly Fee Renewal
                </h2>
                <span className="text-[11px] text-[#8B909A]">
                  Enter Member Unique ID (e.g. the-gym-town-01)
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] hover:bg-[#1C1F23] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Step 1: Unique ID Lookup Bar */}
            <div className="p-3.5 rounded-[6px] bg-[#15171A] border border-[#262A30] space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block">
                Member Unique ID / Roll # *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5]" />
                  <input
                    type="text"
                    value={uniqueIdInput}
                    onChange={(e) => setUniqueIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupMember();
                      }
                    }}
                    placeholder="e.g. the-gym-town-01 or 01..."
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-9 pr-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] placeholder:text-[#8B909A] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupMember()}
                  className="px-4 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                >
                  Verify ID
                </button>
              </div>

              {searchError && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#E5484D] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* Step 2: Member Details Display Card */}
            {selectedMember ? (
              <form onSubmit={handleSubmitRenewal} className="space-y-4">
                {renewalError && <p role="alert" className="text-[11px] text-[#E5484D]">{renewalError}</p>}
                <div className="p-3.5 rounded-[6px] bg-[#15171A] border border-[#262A30] space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#ECEAE6]">
                          {selectedMember.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-[#D9383A] bg-[#0D0E10] px-2 py-0.5 rounded-[4px] border border-[#262A30] font-bold">
                          {selectedMember.rollNumber}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#8B909A] mt-0.5">
                        {selectedMember.mobileNumber} · Current Plan: {selectedMember.planName}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase text-[#8B909A] font-semibold block">
                        Current Expiry
                      </span>
                      <span className="font-mono text-xs font-bold text-[#E5AE4A] tabular-nums">
                        {selectedMember.expiryDate}
                      </span>
                    </div>
                  </div>

                  {selectedMember.balanceDue > 0 && (
                    <div className="p-2 rounded-[4px] bg-[#E5484D]/10 border border-[#E5484D]/25 text-[#E5484D] flex justify-between items-center text-[11px]">
                      <span>Previous Pending Balance:</span>
                      <strong className="font-mono font-bold">
                        Rs. {selectedMember.balanceDue.toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Step 3: Renewal Package & Fee Selection */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                      Renewal Membership Plan *
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-semibold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none cursor-pointer"
                    >
                      {renewalPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — Rs. {p.price.toLocaleString()} ({p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} month)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fee & Discount Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                        Amount Paid (PKR) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        aria-label="Amount Paid (PKR)"
                        value={amountPaid}
                        onChange={(e) => {
                          setAmountPaid(Number(e.target.value));
                          setRenewalError(null);
                        }}
                        className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                        Discount (PKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        aria-label="Discount (PKR)"
                        value={discount}
                        onChange={(e) => {
                          const d = Number(e.target.value) || 0;
                          setDiscount(d);
                          setRenewalError(null);
                          if (activePlan) {
                            setAmountPaid(Math.max(0, activePlan.price - d));
                          }
                        }}
                        className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['Cash', 'JazzCash', 'EasyPaisa', 'Card'] as PaymentMethod[]).map(
                        (method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`py-1.5 rounded-[6px] border text-[11px] font-semibold text-center cursor-pointer transition-colors ${
                              paymentMethod === method
                                ? 'bg-[#D9383A] border-[#D9383A] text-[#ECEAE6]'
                                : 'bg-[#15171A] border-[#262A30] text-[#8B909A] hover:text-[#ECEAE6]'
                            }`}
                          >
                            {method}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Projected Expiry Preview */}
                  <div className="p-3 rounded-[6px] bg-[#0D0E10] border border-[#262A30] flex items-center justify-between text-xs">
                    <span className="text-[#8B909A] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#3DB88B]" />
                      <span>New Valid Expiry Date:</span>
                    </span>
                    <strong className="font-mono text-[#3DB88B] text-sm tabular-nums">
                      {computeProjectedExpiry()}
                    </strong>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                      Renewal Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Cleared at front desk..."
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-1.5 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] border border-[#262A30] text-[#8B909A] hover:text-[#ECEAE6] font-semibold text-xs cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSuccess}
                      className="flex-1 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm Renewal</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="py-8 text-center text-[#8B909A] space-y-2">
                <UserCheck className="w-8 h-8 mx-auto text-[#262A30] stroke-[1.5]" />
                <p className="font-medium text-[#ECEAE6]">No Member Selected</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  Type the member's unique ID above (e.g. <strong>the-gym-town-01</strong>) and click <strong>Verify ID</strong> to load their renewal profile.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Preview Modal */}
      {receiptToPrint && (
        <PrintableReceipt
          payment={receiptToPrint}
          onClose={() => {
            setReceiptToPrint(null);
            onClose();
          }}
          autoTriggerPrint
        />
      )}
    </>
  );
};
