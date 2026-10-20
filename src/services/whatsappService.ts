import { Member, PaymentRecord } from '../types';
import { db } from '../db/storage';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  type: 'EXPIRY_3DAYS' | 'EXPIRED' | 'RENEWAL_CONFIRMATION' | 'PAYMENT_RECEIPT' | 'BALANCE_REMINDER';
  template: string;
}

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl_3days',
    name: '3-Day Expiry Reminder',
    type: 'EXPIRY_3DAYS',
    template: `Salam [Member Name], your membership at THE GYM TOWN is expiring in 3 days on [Expiry Date]. Please renew to avoid interruption.`,
  },
  {
    id: 'tpl_expired',
    name: 'Membership Expired Notice',
    type: 'EXPIRED',
    template: `Salam [Member Name], your membership at THE GYM TOWN has expired on [Expiry Date]. Please visit the reception desk to renew your plan. Thank you!`,
  },
  {
    id: 'tpl_receipt',
    name: 'Official Payment Receipt',
    type: 'PAYMENT_RECEIPT',
    template: `*THE GYM TOWN — PAYMENT RECEIPT*
Receipt #: [Receipt Number]
Date: [Date]
Member: [Member Name] (ID: [Roll Number])

Amount Received: *Rs. [Amount]*
Payment Mode: [Payment Method]
Purpose: [Purpose]
Remaining Balance: Rs. [Balance Due]

Thank you for training with The Gym Town Hyderabad!`,
  },
  {
    id: 'tpl_balance',
    name: 'Outstanding Balance Reminder',
    type: 'BALANCE_REMINDER',
    template: `Salam [Member Name], gentle reminder from THE GYM TOWN regarding your pending dues of Rs. [Balance Due]. Please clear at the reception desk at your earliest convenience.`,
  },
];

export class WhatsAppService {
  /**
   * Cleans Pakistani mobile/WhatsApp numbers to international E.164 without plus or spaces (e.g. 923001234567)
   */
  public static cleanPhoneNumber(phone: string): string {
    let clean = (phone || '').replace(/[^\d]/g, '');
    if (clean.startsWith('03')) {
      clean = '92' + clean.substring(1);
    } else if (clean.startsWith('3') && clean.length === 10) {
      clean = '92' + clean;
    }
    return clean;
  }

  /**
   * Generates the official prompt-specified direct WhatsApp link:
   * https://wa.me/<PhoneNumber>?text=Salam%20<MemberName>,%20your%20membership%20at%20THE%20GYM%20TOWN%20is%20expiring%20in%203%20days%20on%20<ExpiryDate>.%20Please%20renew%20to%20avoid%20interruption.
   */
  public static getOfficial3DayDirectUrl(member: Member): string {
    const cleanPhone = this.cleanPhoneNumber(member.whatsappNumber || member.mobileNumber);
    const message = `Salam ${member.fullName}, your membership at THE GYM TOWN is expiring in 3 days on ${member.expiryDate}. Please renew to avoid interruption.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Generates a generic click-to-chat URL
   */
  public static getClickToChatUrl(phone: string, message: string): string {
    const cleanPhone = this.cleanPhoneNumber(phone);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Checks if a reminder was already triggered for this member today
   */
  public static isReminderSentToday(member: Member): boolean {
    if (!member.lastReminderSentDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return member.lastReminderSentDate === today;
  }

  /**
   * Direct trigger for 3-Day Expiry reminder:
   * 1. Returns direct WhatsApp Web URL
   * 2. Logs notification in DB
   * 3. Sets lastReminderSentDate on member to prevent duplicate alerts
   */
  public static trigger3DayExpiryReminder(member: Member): { url: string; alreadySentToday: boolean } {
    const alreadySentToday = this.isReminderSentToday(member);
    const today = new Date().toISOString().split('T')[0];
    const url = this.getOfficial3DayDirectUrl(member);

    // Update member record in DB with today's reminder stamp
    db.updateMember(member.id, {
      lastReminderSentDate: today,
    });

    // Record notification log
    db.recordNotification({
      memberId: member.id,
      memberName: member.fullName,
      whatsappNumber: member.whatsappNumber || member.mobileNumber,
      messageType: 'EXPIRY_3DAYS',
      messageText: `Salam ${member.fullName}, your membership at THE GYM TOWN is expiring in 3 days on ${member.expiryDate}. Please renew to avoid interruption.`,
      status: 'CLICK_TO_CHAT',
      sentAt: new Date().toISOString(),
    });

    return { url, alreadySentToday };
  }

  /**
   * Identifies all members whose subscription ends within 3 days (0 to 3 days remaining)
   */
  public static getMembersExpiringIn3Days(): { member: Member; daysLeft: number; sentToday: boolean }[] {
    const members = db.getMembers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: { member: Member; daysLeft: number; sentToday: boolean }[] = [];

    members.forEach((m) => {
      if (m.archived || m.status === 'FROZEN') return;
      const expiry = new Date(m.expiryDate);
      expiry.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      // Between 0 and 3 days remaining
      if (diffDays >= 0 && diffDays <= 3) {
        results.push({
          member: m,
          daysLeft: diffDays,
          sentToday: this.isReminderSentToday(m),
        });
      }
    });

    return results;
  }

  /**
   * Direct payment receipt WhatsApp link
   */
  public static getPaymentReceiptUrl(member: Member, payment: PaymentRecord): string {
    const cleanPhone = this.cleanPhoneNumber(member.whatsappNumber || member.mobileNumber);
    const text = `*THE GYM TOWN — PAYMENT RECEIPT*
Receipt #: ${payment.receiptNumber}
Date: ${payment.createdAt.split('T')[0]}
Member: ${member.fullName} (ID: ${member.rollNumber})

Amount Received: *Rs. ${payment.amount.toLocaleString()}*
Payment Mode: ${payment.paymentMethod}
Remaining Balance: Rs. ${member.balanceDue.toLocaleString()}

Thank you for training with The Gym Town Hyderabad!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
}
