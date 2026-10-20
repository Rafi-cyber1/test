import { Member, MemberFeeLedgerEntry, PaymentRecord, ExpenseRecord, AttendanceRecord } from '../types';

export class ExportService {
  /**
   * Triggers download of raw string data as a file
   */
  private static downloadFile(filename: string, content: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
    const blob = new Blob(['\uFEFF', content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Escape CSV cell
   */
  private static escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * Export all registered members to CSV
   */
  public static exportMembersToCsv(members: Member[]): void {
    const headers = [
      'Roll Number',
      'Full Name',
      'Father Name',
      'Mobile',
      'WhatsApp',
      'Email',
      'Gender',
      'Registration Date',
      'Plan Name',
      'Start Date',
      'Expiry Date',
      'Status',
      'Payment Status',
      'Total Fee (PKR)',
      'Paid Amount (PKR)',
      'Balance Due (PKR)',
      'Emergency Contact',
      'Emergency Phone',
      'Address',
    ];

    const rows = members.map((m) => [
      this.escapeCsv(m.rollNumber),
      this.escapeCsv(m.fullName),
      this.escapeCsv(m.fatherName || ''),
      this.escapeCsv(m.mobileNumber),
      this.escapeCsv(m.whatsappNumber),
      this.escapeCsv(m.email || ''),
      this.escapeCsv(m.gender),
      this.escapeCsv(m.registrationDate),
      this.escapeCsv(m.planName),
      this.escapeCsv(m.startDate),
      this.escapeCsv(m.expiryDate),
      this.escapeCsv(m.status),
      this.escapeCsv(m.paymentStatus),
      m.totalFee,
      m.paidAmount,
      m.balanceDue,
      this.escapeCsv(m.emergencyContactName),
      this.escapeCsv(m.emergencyContactPhone),
      this.escapeCsv(m.address || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const timestamp = new Date().toISOString().split('T')[0];
    this.downloadFile(`TheGymTown_Members_${timestamp}.csv`, csvContent);
  }

  /**
   * Export financial ledger payments to CSV
   */
  public static exportPaymentsToCsv(payments: PaymentRecord[]): void {
    const headers = [
      'Receipt #',
      'Date & Time',
      'Roll Number',
      'Member Name',
      'Amount (PKR)',
      'Payment Method',
      'Payment Type',
      'Received By',
      'Notes',
    ];

    const rows = payments.map((p) => [
      this.escapeCsv(p.receiptNumber),
      this.escapeCsv(p.createdAt),
      this.escapeCsv(p.rollNumber),
      this.escapeCsv(p.memberName),
      p.amount,
      this.escapeCsv(p.paymentMethod),
      this.escapeCsv(p.paymentType),
      this.escapeCsv(p.receivedBy),
      this.escapeCsv(p.notes || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const timestamp = new Date().toISOString().split('T')[0];
    this.downloadFile(`TheGymTown_Payments_${timestamp}.csv`, csvContent);
  }

  public static buildMemberFeeLedgerCsv(member: Member, entries: MemberFeeLedgerEntry[]): string {
    const headers = [
      'Roll Number',
      'Member Name',
      'Transaction Date',
      'Billing Month',
      'Description',
      'Type',
      'Debit (PKR)',
      'Credit (PKR)',
      'Running Balance (PKR)',
      'Payment Method',
      'Recorded By',
    ];
    let runningBalance = 0;
    const rows = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date)
        || new Date(a.createdAt.replace(' ', 'T')).getTime() - new Date(b.createdAt.replace(' ', 'T')).getTime())
      .map((entry) => {
        runningBalance += entry.type === 'CHARGE' ? entry.amount : -entry.amount;
        return [
          this.escapeCsv(member.rollNumber),
          this.escapeCsv(member.fullName),
          this.escapeCsv(entry.date),
          this.escapeCsv(entry.billingMonth || entry.date.slice(0, 7)),
          this.escapeCsv(entry.description),
          this.escapeCsv(entry.type),
          entry.type === 'CHARGE' ? entry.amount : 0,
          entry.type === 'PAYMENT' ? entry.amount : 0,
          runningBalance,
          this.escapeCsv(entry.paymentMethod || ''),
          this.escapeCsv(entry.recordedBy),
        ].join(',');
      });
    return [headers.join(','), ...rows].join('\r\n');
  }

  public static exportMemberFeeLedgerToCsv(member: Member, entries: MemberFeeLedgerEntry[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const csvContent = this.buildMemberFeeLedgerCsv(member, entries);
    this.downloadFile(`TheGymTown_Fee_Ledger_${member.rollNumber}_${timestamp}.csv`, csvContent);
  }

  /**
   * Export attendance logs to CSV
   */
  public static exportAttendanceToCsv(attendance: AttendanceRecord[]): void {
    const headers = [
      'Record ID',
      'Date & Time',
      'Roll Number',
      'Member Name',
      'Check-In Time',
      'Check-Out Time',
      'Method',
      'Access Status',
      'Notes',
    ];

    const rows = attendance.map((a) => [
      this.escapeCsv(a.id),
      this.escapeCsv(a.timestamp),
      this.escapeCsv(a.rollNumber),
      this.escapeCsv(a.memberName),
      this.escapeCsv(a.checkInTime),
      this.escapeCsv(a.checkOutTime || '-'),
      this.escapeCsv(a.method),
      this.escapeCsv(a.accessStatus),
      this.escapeCsv(a.notes || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const timestamp = new Date().toISOString().split('T')[0];
    this.downloadFile(`TheGymTown_Attendance_${timestamp}.csv`, csvContent);
  }
}
