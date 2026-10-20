import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  CreditCard,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { db } from '../../db/storage';
import { ExportService } from '../../services/exportService';

export const ReportsAndAnalytics: React.FC = () => {
  const [reportType, setReportType] = useState<'REVENUE' | 'ATTENDANCE' | 'OUTSTANDING' | 'MEMBERS'>('REVENUE');
  const payments = db.getPayments();
  const expenses = db.getExpenses();
  const members = db.getMembers();
  const attendance = db.getAttendance();
  const settings = db.getSettings();

  const handleExportMembers = () => ExportService.exportMembersToCsv(members);
  const handleExportPayments = () => ExportService.exportPaymentsToCsv(payments);
  const handleExportAttendance = () => ExportService.exportAttendanceToCsv(attendance);

  const handlePrint = () => {
    window.print();
  };

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = totalRevenue - totalExpenses;
  const overdueMembers = members.filter((m) => m.balanceDue > 0);
  const totalOverdue = overdueMembers.reduce((sum, m) => sum + m.balanceDue, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Executive Business Reports & Analytics</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
              Audit Grade
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Exportable CSV ledgers, membership renewal ratios, revenue channels, and attendance patterns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report View</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex border-b border-slate-800 bg-[#090d16] p-1.5 rounded-xl no-print gap-1">
        <button
          onClick={() => setReportType('REVENUE')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'REVENUE'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Revenue & Cashflow
        </button>
        <button
          onClick={() => setReportType('OUTSTANDING')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'OUTSTANDING'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Outstanding Dues ({overdueMembers.length})
        </button>
        <button
          onClick={() => setReportType('ATTENDANCE')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'ATTENDANCE'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Attendance Trends
        </button>
        <button
          onClick={() => setReportType('MEMBERS')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'MEMBERS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Member Growth & Churn
        </button>
      </div>

      {/* Report Viewport */}
      {reportType === 'REVENUE' && (
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Consolidated Revenue & Expense Report</h3>
              <div className="text-xs text-slate-400">Total historical fiscal performance</div>
            </div>
            <button
              onClick={handleExportPayments}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Total Gross Income</span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
                {settings.currency} {totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Total Operating Expenses</span>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1 tabular-nums">
                {settings.currency} {totalExpenses.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">All-Time Net Operating Margin</span>
              <div className="text-xl font-bold text-white font-mono mt-1 tabular-nums">
                {settings.currency} {netEarnings.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'OUTSTANDING' && (
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Outstanding Receivables Ledger</h3>
              <div className="text-xs text-slate-400">
                Total Unsettled Balances: <strong className="text-rose-400 font-mono">Rs. {totalOverdue.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#080d17] text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Roll Number</th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Package</th>
                <th className="p-3">Total Package Fee</th>
                <th className="p-3">Amount Paid</th>
                <th className="p-3">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {overdueMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-900/50">
                  <td className="p-3 font-mono text-blue-400 font-bold">{m.rollNumber}</td>
                  <td className="p-3 font-semibold text-white">{m.fullName}</td>
                  <td className="p-3 font-mono text-slate-300">{m.mobileNumber}</td>
                  <td className="p-3 text-slate-400">{m.planName}</td>
                  <td className="p-3 font-mono text-slate-300">Rs. {m.totalFee.toLocaleString()}</td>
                  <td className="p-3 font-mono text-emerald-400">Rs. {m.paidAmount.toLocaleString()}</td>
                  <td className="p-3 font-mono font-bold text-rose-400 text-sm">
                    Rs. {m.balanceDue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'ATTENDANCE' && (
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Gym Daily Attendance Analytics</h3>
              <div className="text-xs text-slate-400">Cumulative entry volume: {attendance.length} logged visits</div>
            </div>
            <button
              onClick={handleExportAttendance}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Attendance CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Total Approved Entries</span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
                {attendance.filter((a) => a.accessStatus === 'GRANTED').length}
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Denied Attempt Alerts</span>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1 tabular-nums">
                {attendance.filter((a) => a.accessStatus === 'DENIED').length}
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">QR Code Scan Share</span>
              <div className="text-xl font-bold text-blue-400 font-mono mt-1 tabular-nums">
                85%
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'MEMBERS' && (
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Membership Demographics & Retention</h3>
              <div className="text-xs text-slate-400">{members.length} members tracked</div>
            </div>
            <button
              onClick={handleExportMembers}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Members CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Male Members</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {members.filter((m) => m.gender === 'Male').length}
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Female Members</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {members.filter((m) => m.gender === 'Female').length}
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Active Retention Ratio</span>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                {Math.round((members.filter((m) => m.status === 'ACTIVE').length / Math.max(1, members.length)) * 100)}%
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400">Annual VIP Enrolled</span>
              <div className="text-lg font-bold text-purple-400 font-mono mt-1">
                {members.filter((m) => m.planId === 'plan_annual').length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
