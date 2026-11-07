import React, { useEffect, useState } from 'react';
import { X, Printer, Send, Check, MessageSquare } from 'lucide-react';
import { PaymentRecord, Member } from '../../types';
import { db } from '../../db/storage';
import { WhatsAppService } from '../../services/whatsappService';
import { printDocument } from '../../services/printService';

interface PrintableReceiptProps {
  payment: PaymentRecord;
  onClose: () => void;
  autoTriggerPrint?: boolean;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  payment,
  onClose,
  autoTriggerPrint = true,
}) => {
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const settings = db.getSettings();
  const member = db.getMemberById(payment.memberId);
  const lateFee = payment.lateFee || 0;
  const membershipFee = Math.max(0, payment.amount - lateFee);
  const membershipMonth = payment.billingMonth || payment.createdAt.slice(0, 7);

  useEffect(() => {
    if (autoTriggerPrint) {
      const timer = window.setTimeout(() => {
        void printDocument('receipt');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [payment, settings.gymName, autoTriggerPrint]);

  const handlePrint = () => {
    void printDocument('receipt');
  };

  const handleSendWhatsAppReceipt = () => {
    const targetMember = member || {
      fullName: payment.memberName,
      rollNumber: payment.rollNumber,
      mobileNumber: '',
      whatsappNumber: '',
      balanceDue: 0,
      expiryDate: '',
      planName: payment.paymentType,
    } as unknown as Member;

    // Use member's phone number or prompt if missing
    let phone = targetMember.whatsappNumber || targetMember.mobileNumber;
    if (!phone) {
      const userEntered = prompt(`Enter WhatsApp number for ${payment.memberName}:`, '03001234567');
      if (!userEntered) return;
      phone = userEntered;
    }

    const cleanPhone = WhatsAppService.cleanPhoneNumber(phone);
    const balanceText = targetMember.balanceDue > 0
      ? `Rs. ${targetMember.balanceDue.toLocaleString()}`
      : 'Nil (Fully Cleared)';

    const receiptMessage = `*THE GYM TOWN — OFFICIAL PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━
*Receipt No:* ${payment.receiptNumber}
*Date:* ${payment.createdAt.replace('T', ' ').substring(0, 19)}
*Member Name:* ${payment.memberName}
*Member Roll #:* ${payment.rollNumber}
*Package / Type:* ${targetMember.planName || payment.paymentType}

💰 *Amount Received:* *Rs. ${payment.amount.toLocaleString()}*
💳 *Payment Mode:* ${payment.paymentMethod}
⚖️ *Remaining Balance:* ${balanceText}
${targetMember.expiryDate ? `📅 *Membership Valid Till:* ${targetMember.expiryDate}\n` : ''}👤 *Issued By:* ${payment.receivedBy || settings.receptionistProfile?.name || 'Front Desk'}
━━━━━━━━━━━━━━━━━━━━
*Address:* ${settings.address}, ${settings.city}
*Helpline:* ${settings.phone}

Thank you for being part of THE GYM TOWN family! Stay consistent and train hard! 💪
━━━━━━━━━━━━━━━━━━━━
Software created by CRYONIX`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(receiptMessage)}`;
    window.open(waUrl, '_blank');
    setWhatsappSent(true);

    // Record notification in DB
    db.recordNotification({
      memberId: payment.memberId,
      memberName: payment.memberName,
      whatsappNumber: phone,
      messageType: 'PAYMENT_RECEIPT',
      messageText: receiptMessage,
      status: 'CLICK_TO_CHAT',
      sentAt: new Date().toISOString(),
    });
  };

  const handlePrintAndSend = () => {
    handleSendWhatsAppReceipt();
    handlePrint();
  };

  const memberPhone = member?.whatsappNumber || member?.mobileNumber || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-raised border border-line rounded-[8px] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-3.5 border-b border-line bg-panel flex items-center justify-between no-print">
          <div>
            <h3 className="text-xs font-bold text-ink flex items-center gap-2">
              <span>Receipt Issued: {payment.receiptNumber}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-app text-ok border border-line">
                Rs. {payment.amount.toLocaleString()}
              </span>
            </h3>
            <p className="text-[11px] text-muted mt-0.5">
              Member: <strong className="text-ink">{payment.memberName}</strong> ({payment.rollNumber})
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close receipt"
            className="p-1 text-muted hover:text-ink rounded-[4px] hover:bg-raised transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Quick Action Buttons for Receptionist */}
        <div className="p-3 bg-panel border-b border-line grid grid-cols-2 gap-2 no-print">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-raised hover:bg-hover text-ink rounded-[6px] text-xs font-semibold border border-line transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-muted" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={handleSendWhatsAppReceipt}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
              whatsappSent
                ? 'bg-ok/20 text-ok border border-ok/40'
                : 'bg-brand hover:bg-brand-strong text-white'
            }`}
          >
            {whatsappSent ? (
              <>
                <Check className="w-3.5 h-3.5 text-ok" />
                <span>Sent on WhatsApp</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send WhatsApp Receipt</span>
              </>
            )}
          </button>
        </div>

        <div className="px-3 py-2 bg-panel border-b border-line flex items-center justify-between text-[11px] no-print">
          <span className="text-muted">Thermal paper width</span>
          <div className="flex gap-1">
            {([58, 80] as const).map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => setPaperWidth(width)}
                aria-pressed={paperWidth === width}
                className={`px-2.5 py-1 rounded border ${
                  paperWidth === width
                    ? 'border-brand text-ink'
                    : 'border-line text-muted'
                }`}
              >
                {width}mm
              </button>
            ))}
          </div>
        </div>

        {/* Combined One-Tap Action */}
        <div className="px-3 pt-2 pb-1 bg-panel no-print flex items-center justify-between text-[11px] text-muted">
          <span className="truncate">
            {memberPhone ? `Member Mobile: ${memberPhone}` : 'No phone saved on profile'}
          </span>
          <button
            onClick={handlePrintAndSend}
            className="text-brand hover:underline font-semibold cursor-pointer shrink-0 ml-2"
          >
            Print & Send Both &rarr;
          </button>
        </div>

        {/* Thermal Receipt Paper Viewport */}
        <div className="p-4 sm:p-6 bg-app flex justify-center overflow-y-auto max-h-[60vh]">
          <div
            id="receipt-area"
            className={`w-[80mm] max-w-full box-border bg-white text-black p-2 font-mono text-[10px] leading-tight shadow-xl print-receipt print-receipt--${paperWidth}`}
            style={{ width: `${paperWidth}mm` }}
          >
            <style>{`@media print { @page { size: ${paperWidth}mm 200mm; margin: 0; } }`}</style>
            <header className="text-center pb-2 border-b border-black border-dashed">
              {/* Same brand logo as the app; this copy has its dark background baked
                  in so the white/red lettering stays visible on thermal paper. */}
              <img
                src={`${import.meta.env.BASE_URL}logo-receipt.png`}
                alt={settings.gymName || 'The Gym Town'}
                className="receipt-logo mx-auto mb-1 h-10 max-w-full object-contain"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
              <div className="font-extrabold text-sm uppercase">{settings.gymName}</div>
              <div>{settings.address}</div>
              <div>{settings.city} · {settings.phone}</div>
            </header>

            <section className="py-2 border-b border-black border-dashed space-y-1">
              <div className="flex justify-between gap-2"><span>RECEIPT #</span><span>{payment.receiptNumber}</span></div>
              <div className="flex justify-between gap-2"><span>PAYMENT DATE</span><span>{payment.paymentDate || payment.createdAt.replace('T', ' ').substring(0, 10)}</span></div>
              <div className="flex justify-between gap-2"><span>MEMBER</span><span className="text-right">{payment.memberName}</span></div>
              <div className="flex justify-between gap-2"><span>MEMBER ID</span><span>{payment.rollNumber}</span></div>
              <div className="flex justify-between gap-2"><span>MEMBERSHIP MONTH</span><span>{membershipMonth}</span></div>
            </section>

            <table className="w-full my-2 border-b border-black border-dashed">
              <thead>
                <tr className="border-b border-black border-dashed">
                  <th className="py-1 text-left font-bold">FEE</th>
                  <th className="py-1 text-right font-bold">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2 align-top">{payment.notes || payment.paymentType.replace(/_/g, ' ')}</td>
                  <td className="py-1 text-right align-top whitespace-nowrap">Rs. {membershipFee.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Late payment charge</td>
                  <td className="py-1 text-right whitespace-nowrap">Rs. {lateFee.toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-black border-dashed font-bold">
                  <td className="py-1">TOTAL AMOUNT PAID</td>
                  <td className="py-1 text-right whitespace-nowrap">Rs. {payment.amount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div className="py-2 border-b border-black border-dashed">
              PAYMENT METHOD: {payment.paymentMethod.toUpperCase()}
            </div>

            <div className="py-2 border-b border-black border-dashed">
              <div className="font-bold">LATE FEE / PENALTY NOTICE</div>
              <div>Rs. 500 penalty is charged when the monthly fee is paid after its due date.</div>
              <div>Pay on or before the due date to avoid the penalty.</div>
            </div>
            <footer className="pt-2 text-[9px] leading-snug">
              <div className="font-bold mb-1">IMPORTANT TERMS</div>
              <div>1. Membership fees are non-refundable.</div>
              <div>2. Late payment penalty: Rs. 500 applies when the monthly fee is paid after the due date.</div>
              <div>3. Accepted payment method: CASH ONLY.</div>
            </footer>
            <div className="pt-2 text-center text-[9px]">Thank you for your payment.</div>
            <div className="pt-1 text-center text-[9px] font-bold">Software created by CRYONIX</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-panel border-t border-line flex items-center justify-between no-print">
          <span className="text-[11px] text-muted">
            {paperWidth}mm thermal receipt · Auto-print enabled
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-ink text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
