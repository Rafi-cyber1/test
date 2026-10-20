import React, { useState } from 'react';
import {
  CheckCircle,
  Search,
  User,
  Clock,
  AlertTriangle,
  Calendar,
  Check,
  X,
} from 'lucide-react';
import { db } from '../../db/storage';
import { soundEffects } from '../../services/soundEffects';
import { Member } from '../../types';

export const SmartAttendance: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [lastCheckInResult, setLastCheckInResult] = useState<{
    status: 'IDLE' | 'SUCCESS' | 'DENIED';
    message: string;
    member?: Member;
  }>({ status: 'IDLE', message: '' });

  const members = db.getMembers();
  const attendanceRecords = db.getAttendance();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter((a) => a.timestamp.startsWith(todayStr));

  const suggestions = searchInput.trim().length >= 1
    ? members
        .filter((m) => {
          const q = searchInput.toLowerCase().trim();
          return (
            m.fullName.toLowerCase().includes(q) ||
            m.rollNumber.toLowerCase().includes(q) ||
            m.mobileNumber.includes(q)
          );
        })
        .slice(0, 5)
    : [];

  const handleCheckInMember = (member: Member) => {
    if (!members.some((activeMember) => activeMember.id === member.id)) {
      soundEffects.playAccessDenied();
      setLastCheckInResult({
        status: 'DENIED',
        message: 'Student not found! Please enter a valid Roll Number.',
      });
      return;
    }

    if (db.isAttendanceMarkedToday(member.id)) {
      soundEffects.playAccessDenied();
      setLastCheckInResult({
        status: 'DENIED',
        message: 'Attendance already marked for today.',
        member,
      });
      setSearchInput('');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(member.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const isExpired = expiry < today;

    if (isExpired) {
      soundEffects.playAccessDenied();
      db.recordAttendance({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method: 'MANUAL',
        accessStatus: 'DENIED',
        denialReason: `Membership expired on ${member.expiryDate}`,
      });
      setLastCheckInResult({
        status: 'DENIED',
        message: `Check-in blocked: Membership expired on ${member.expiryDate}. Please collect renewal fee.`,
        member,
      });
      setSearchInput('');
      return;
    }

    try {
      db.recordAttendance({
        memberId: member.id,
        rollNumber: member.rollNumber,
        memberName: member.fullName,
        method: 'MANUAL',
        accessStatus: 'GRANTED',
      });
    } catch (error) {
      soundEffects.playAccessDenied();
      setLastCheckInResult({
        status: 'DENIED',
        message: error instanceof Error ? error.message : 'Unable to record attendance.',
        member,
      });
      setSearchInput('');
      return;
    }

    soundEffects.playAccessGranted();
    setLastCheckInResult({
      status: 'SUCCESS',
      message: `Check-in approved: Welcome ${member.fullName}! Valid till ${member.expiryDate}.`,
      member,
    });
    setSearchInput('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const query = searchInput.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, '');
    const isPhoneQuery = db.isValidPhoneNumber(searchInput);
    const match = members.find((member) => {
      const rollNumber = member.rollNumber.trim().toLowerCase();
      const rollDigits = rollNumber.replace(/\D/g, '').replace(/^0+/, '');
      const queryRollDigits = queryDigits.replace(/^0+/, '');
      const normalizedMemberPhone = member.mobileNumber.replace(/\D/g, '');
      return rollNumber === query
        || member.fullName.trim().toLowerCase() === query
        || (/^\d+$/.test(query) && rollDigits === queryRollDigits)
        || (isPhoneQuery && normalizedMemberPhone === queryDigits);
    });

    if (!match) {
      setLastCheckInResult({
        status: 'DENIED',
        message: 'Student not found! Please enter a valid Roll Number.',
      });
      return;
    }

    handleCheckInMember(match);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0D0E10] text-[#ECEAE6]">
      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
              Manual Attendance Check-In Register
            </h2>
            <span className="font-mono text-xs text-[#3DB88B] bg-[#1C1F23] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
              {todayRecords.length} Today
            </span>
          </div>
          <p className="text-xs text-[#8B909A] mt-1">
            Fast counter check-in by Member Roll #, Full Name, or WhatsApp contact.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8B909A] bg-[#1C1F23] px-3 py-1.5 rounded-[6px] border border-[#262A30]">
          <Calendar className="w-3.5 h-3.5 text-[#D9383A]" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Check-in Input Bar */}
      <div className="p-5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-3">
        <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block">
          Scan or Type Roll # / Mobile Number
        </label>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B909A] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. TGT-2026-0001, 0001, or 03001234567..."
              className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-9 pr-4 py-2 text-xs font-mono text-[#ECEAE6] placeholder:text-[#8B909A] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 focus:ring-2 focus:ring-[#D9383A]"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Check In</span>
          </button>
        </form>

        {/* Real-time suggestions */}
        {suggestions.length > 0 && (
          <div className="border border-[#262A30] rounded-[6px] bg-[#1C1F23] divide-y divide-[#262A30] overflow-hidden mt-2">
            {suggestions.map((m) => (
              <div
                key={m.id}
                onClick={() => handleCheckInMember(m)}
                className="p-2.5 flex items-center justify-between hover:bg-[#262A30]/50 transition-colors cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-xs text-[#ECEAE6]">{m.fullName}</div>
                  <span className="font-mono text-[10px] text-[#8B909A]">
                    {m.rollNumber} · {m.mobileNumber} · {m.planName}
                  </span>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-[4px] bg-[#15171A] hover:bg-[#D9383A] hover:text-[#ECEAE6] border border-[#262A30] text-[11px] font-medium text-[#ECEAE6] transition-colors"
                >
                  Check In
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Feedback Alert */}
        {lastCheckInResult.status !== 'IDLE' && (
          <div
            role={lastCheckInResult.status === 'SUCCESS' ? 'status' : 'alert'}
            className={`p-3 rounded-[6px] border text-xs font-medium flex items-center gap-2 ${
              lastCheckInResult.status === 'SUCCESS'
                ? 'bg-[#1C1F23] border-[#262A30] border-l-4 border-l-[#3DB88B] text-[#3DB88B]'
                : 'bg-[#1C1F23] border-[#262A30] border-l-4 border-l-[#E5484D] text-[#E5484D]'
            }`}
          >
            {lastCheckInResult.status === 'SUCCESS' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{lastCheckInResult.message}</span>
          </div>
        )}
      </div>

      {/* Today Attendance Log Table */}
      <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
        <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
          <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
            Today's Check-In Records ({todayRecords.length})
          </h3>
          <span className="text-xs text-[#8B909A]">Real-time desk arrivals</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[10px] uppercase tracking-wider">
                <th className="py-2 px-4 font-semibold">Time</th>
                <th className="py-2 px-4 font-semibold">Roll #</th>
                <th className="py-2 px-4 font-semibold">Member Name</th>
                <th className="py-2 px-4 font-semibold">Method</th>
                <th className="py-2 px-4 font-semibold text-center">Status</th>
                <th className="py-2 px-4 font-semibold">Notes / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262A30]">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8B909A]">
                    No members checked in yet today. Use the counter search bar above to log check-ins.
                  </td>
                </tr>
              ) : (
                todayRecords.map((rec) => (
                  <tr key={rec.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                    <td className="py-2 px-4 font-mono text-[#8B909A] text-[11px] tabular-nums">
                      {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2 px-4 font-mono font-bold text-[#ECEAE6]">{rec.rollNumber}</td>
                    <td className="py-2 px-4 font-semibold text-[#ECEAE6]">{rec.memberName}</td>
                    <td className="py-2 px-4 font-mono text-[#8B909A]">{rec.method}</td>
                    <td className="py-2 px-4 text-center">
                      {rec.accessStatus === 'GRANTED' ? (
                        <span className="status-pill-success">Approved</span>
                      ) : (
                        <span className="status-pill-danger">Blocked</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-[#8B909A]">{rec.denialReason || rec.notes || 'Routine check-in'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
