import React, { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Printer,
  Send,
  CreditCard,
  UserMinus,
  UserRoundPen,
  ArchiveRestore,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import { addCalendarMonths, db } from '../../db/storage';
import { BloodGroup, Member, PaymentRecord } from '../../types';
import { WhatsAppService } from '../../services/whatsappService';
import { NewMemberModal } from './NewMemberModal';
import { MemberProfileModal } from './MemberProfileModal';
import { PrintableMemberCard } from './PrintableMemberCard';
import { PrintableReceipt } from '../finance/PrintableReceipt';

interface MemberManagementProps {
  onSelectMember?: (member: Member) => void;
  selectedMemberFromParent?: Member | null;
  onClearSelectedMember?: () => void;
  onOpenQuickPaymentForMember?: (member: Member) => void;
  onOpenMonthlyRenewal?: (rollNumber?: string) => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({
  onSelectMember,
  selectedMemberFromParent,
  onClearSelectedMember,
  onOpenQuickPaymentForMember,
  onOpenMonthlyRenewal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'UNPAID'>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showQuickRemoveModal, setShowQuickRemoveModal] = useState(false);
  const [quickRemoveSearch, setQuickRemoveSearch] = useState('');
  const [activeProfileMember, setActiveProfileMember] = useState<Member | null>(selectedMemberFromParent || null);
  const [printBadgeMember, setPrintBadgeMember] = useState<Member | null>(null);
  const [registrationReceipt, setRegistrationReceipt] = useState<PaymentRecord | null>(null);
  const [memberToLeave, setMemberToLeave] = useState<Member | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showRemovedMembers, setShowRemovedMembers] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editDurationMonths, setEditDurationMonths] = useState(1);
  const [editError, setEditError] = useState<string | null>(null);
  const [, setRefreshKey] = useState(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (selectedMemberFromParent) {
      setActiveProfileMember(selectedMemberFromParent);
    }
  }, [selectedMemberFromParent]);

  const allMembers = db.getMembers();
  const removedMembers = db.getAllMembers().filter((member) => member.archived);
  const formatRemovalDate = (member: (typeof removedMembers)[number]) => {
    if (member.removedAt) return member.removedAt.slice(0, 10);
    const periods = member.membershipPeriods || [];
    const lastPeriod = periods[periods.length - 1];
    return lastPeriod?.endDate || member.updatedAt.slice(0, 10);
  };
  const visibleMembers = showRemovedMembers ? removedMembers : allMembers;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDerivedStatus = (m: Member): 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'UNPAID' => {
    if (m.balanceDue > 0 && m.paidAmount === 0) return 'UNPAID';
    const expiry = new Date(m.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 3) return 'EXPIRING';
    if (m.balanceDue > 0) return 'UNPAID';
    return 'ACTIVE';
  };

  const filteredMembers = visibleMembers.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.fullName.toLowerCase().includes(query) ||
      m.rollNumber.toLowerCase().includes(query) ||
      m.mobileNumber.includes(query) ||
      (m.cnic && m.cnic.toLowerCase().includes(query)) ||
      (m.fatherName && m.fatherName.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (showRemovedMembers || statusFilter === 'ALL') return true;
    const derived = getDerivedStatus(m);
    return derived === statusFilter;
  });

  const handleLeaveMember = (member: Member) => {
    const success = db.leaveMember(member.id);
    if (success) {
      showToast(`${member.fullName} (${member.rollNumber}) marked as left; history retained`);
      setMemberToLeave(null);
      if (activeProfileMember?.id === member.id) {
        setActiveProfileMember(null);
        if (onClearSelectedMember) onClearSelectedMember();
      }
      reload();
    } else {
      showToast('Unable to mark member as left');
    }
  };

  const openEditMember = (member: Member) => {
    const start = new Date(`${member.startDate}T00:00:00`);
    const expiry = new Date(`${member.expiryDate}T00:00:00`);
    const duration = Math.max(1, Math.round((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
    setEditDurationMonths(duration);
    setEditError(null);
    setEditingMember({ ...member });
  };

  const handleSaveMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMember) return;
    try {
      const updated = db.updateMember(editingMember.id, {
        fullName: editingMember.fullName,
        fatherName: editingMember.fatherName,
        mobileNumber: editingMember.mobileNumber,
        whatsappNumber: editingMember.whatsappNumber,
        email: editingMember.email,
        gender: editingMember.gender,
        bloodGroup: editingMember.bloodGroup,
        dateOfBirth: editingMember.dateOfBirth,
        address: editingMember.address,
        registrationDate: editingMember.registrationDate,
        planId: editingMember.planId,
        planName: editingMember.planName,
        monthlyFee: editingMember.monthlyFee,
        startDate: editingMember.startDate,
        expiryDate: addCalendarMonths(editingMember.startDate, editDurationMonths),
        emergencyContactName: editingMember.emergencyContactName,
        emergencyContactPhone: editingMember.emergencyContactPhone,
        medicalNotes: editingMember.medicalNotes,
        cnic: editingMember.cnic,
      });
      if (!updated) throw new Error('Member could not be updated.');
      setEditingMember(null);
      showToast(`${updated.fullName} updated successfully`);
      reload();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to update member.');
    }
  };

  // Quick Remove Search Results
  const quickRemoveResults = allMembers.filter((m) => {
    const q = quickRemoveSearch.toLowerCase().trim();
    if (!q) return false;
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.rollNumber.toLowerCase().includes(q) ||
      m.mobileNumber.includes(q)
    );
  }).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-app text-ink">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-20 right-3 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[6px] bg-panel border border-line border-l-4 border-l-ok text-xs font-semibold shadow-xl">
          <Check className="w-4 h-4 text-ok" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="p-3 sm:p-3.5 border-b border-line bg-panel flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg min-w-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, Roll #, mobile, or CNIC..."
              className="w-full bg-raised border border-line rounded-[6px] pl-8 pr-3 py-1.5 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-raised p-0.5 rounded-[6px] border border-line text-xs overflow-x-auto max-w-full">
            {([
              { key: false, label: `Active Members (${allMembers.length})` },
              { key: true, label: `Removed Members (${removedMembers.length})` },
            ]).map((tab) => (
              <button
                key={String(tab.key)}
                onClick={() => { setShowRemovedMembers(tab.key); setStatusFilter('ALL'); }}
                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium whitespace-nowrap ${showRemovedMembers === tab.key ? 'bg-brand text-white font-semibold' : 'text-muted hover:text-ink'}`}
              >{tab.label}</button>
            ))}
          </div>

          {!showRemovedMembers && <div className="flex items-center gap-1 bg-raised p-0.5 rounded-[6px] border border-line text-xs overflow-x-auto max-w-full">
            {(
              [
                { key: 'ALL', label: `All (${allMembers.length})` },
                { key: 'ACTIVE', label: 'Active' },
                { key: 'EXPIRING', label: 'Expiring' },
                { key: 'EXPIRED', label: 'Expired' },
                { key: 'UNPAID', label: 'Unpaid' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.key
                    ? 'bg-brand text-white font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!showRemovedMembers && allMembers.length > 0 && (
            <button
              onClick={() => setShowQuickRemoveModal(true)}
              className="px-3 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-muted hover:text-bad transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Mark Member as Left</span>
            </button>
          )}

          {!showRemovedMembers && onOpenMonthlyRenewal && (
            <button
              onClick={() => onOpenMonthlyRenewal()}
              className="px-3 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-ink hover:border-brand transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Renew Monthly Fee by Member Unique ID (the-gym-town-01)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand" />
              <span>Renew Fee</span>
            </button>
          )}

          {!showRemovedMembers && <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-brand"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Enroll Member</span>
          </button>}
        </div>
      </div>

      {/* Main Table: Sticky header, 44px rows, 1px dividers, row hover highlight */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[760px] text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-raised border-b border-line text-muted text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Roll #</th>
              <th className="py-2.5 px-4 font-semibold">Member Name</th>
              <th className="py-2.5 px-4 font-semibold">Package Plan</th>
              <th className="py-2.5 px-4 font-semibold">Start Date</th>
              <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
              {showRemovedMembers && <th className="py-2.5 px-4 font-semibold">Removed On</th>}
              <th className="py-2.5 px-4 font-semibold text-right">Fee Status</th>
              <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={showRemovedMembers ? 9 : 8} className="py-12 text-center text-muted text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 text-line-strong stroke-[1.5]" />
                  <p className="text-ink font-medium">No members found</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {searchQuery ? 'Try clearing your search query.' : showRemovedMembers ? 'No removed members.' : 'Click Enroll Member above to add your first gym member.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => {
                const derived = getDerivedStatus(m);

                return (
                  <tr
                    key={m.id}
                    className="h-11 hover:bg-raised/60 transition-colors cursor-pointer group"
                    onClick={() => setActiveProfileMember(m)}
                  >
                    <td className="py-2 px-4 font-mono font-bold text-ink tabular-nums">
                      {m.rollNumber}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-raised border border-line flex items-center justify-center shrink-0 text-ink font-condensed font-bold text-xs tracking-wider">
                          {m.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink group-hover:text-brand transition-colors truncate">
                            {m.fullName}
                          </div>
                          <span className="font-mono text-[10px] text-muted">{m.mobileNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-muted truncate max-w-[140px]">{m.planName}</td>
                    <td className="py-2 px-4 font-mono text-muted tabular-nums">{m.startDate}</td>
                    <td className="py-2 px-4 font-mono text-ink tabular-nums">{m.expiryDate}</td>
                    {showRemovedMembers && (
                      <td className="py-2 px-4 font-mono text-muted tabular-nums">
                        {formatRemovalDate(m)}
                      </td>
                    )}
                    <td className="py-2 px-4 text-right font-mono tabular-nums">
                      {m.balanceDue > 0 ? (
                        <span className="text-bad font-bold">Due: Rs. {m.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="text-ok font-semibold">Cleared</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {derived === 'ACTIVE' && (
                        <span className="status-pill-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>Active</span>
                        </span>
                      )}
                      {derived === 'EXPIRING' && (
                        <span className="status-pill-warning">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>Expiring</span>
                        </span>
                      )}
                      {derived === 'EXPIRED' && (
                        <span className="status-pill-danger">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>Expired</span>
                        </span>
                      )}
                      {derived === 'UNPAID' && (
                        <span className="status-pill-danger">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>Unpaid</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!showRemovedMembers && <button
                          onClick={() => openEditMember(m)}
                          className="p-1 text-muted hover:text-ink rounded-[4px] hover:bg-raised cursor-pointer"
                          title="Edit member information"
                        ><UserRoundPen className="w-3.5 h-3.5" /></button>}
                        {showRemovedMembers && <button
                          onClick={() => {
                            if (db.restoreMember(m.id)) {
                              showToast(`${m.fullName} restored to the active directory`);
                              reload();
                            }
                          }}
                          className="px-2 py-1 rounded-[4px] bg-raised hover:bg-hover border border-line text-[11px] text-ok cursor-pointer flex items-center gap-1"
                        ><ArchiveRestore className="w-3 h-3" /> Restore</button>}
                        {!showRemovedMembers && <>
                        <button
                          onClick={() => setActiveProfileMember(m)}
                          className="px-2 py-1 rounded-[4px] bg-raised hover:bg-hover border border-line text-[11px] text-ink cursor-pointer"
                        >
                          Profile
                        </button>

                        {onOpenMonthlyRenewal && (
                          <button
                            onClick={() => onOpenMonthlyRenewal(m.rollNumber)}
                            className="px-2 py-1 rounded-[4px] bg-raised hover:bg-brand hover:text-ink border border-line text-[11px] text-ink font-semibold cursor-pointer transition-colors"
                            title={`Renew ${m.fullName} (${m.rollNumber})`}
                          >
                            Renew
                          </button>
                        )}

                        {m.balanceDue > 0 && onOpenQuickPaymentForMember && (
                          <button
                            onClick={() => onOpenQuickPaymentForMember(m)}
                            className="px-2 py-1 rounded-[4px] bg-brand hover:bg-brand-strong text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Collect
                          </button>
                        )}

                        <button
                          onClick={() => setMemberToLeave(m)}
                          className="p-1 text-muted hover:text-bad rounded-[4px] hover:bg-raised cursor-pointer transition-colors"
                          title="Mark member as left"
                        >
                          <UserMinus className="w-3.5 h-3.5 stroke-[1.5]" />
                        </button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Registration Drawer */}
      <NewMemberModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onMemberCreated={(payment) => {
          showToast('Member enrolled successfully');
          reload();
          if (payment) setRegistrationReceipt(payment);
        }}
      />
      {registrationReceipt && (
        <PrintableReceipt
          payment={registrationReceipt}
          onClose={() => setRegistrationReceipt(null)}
        />
      )}

      {/* Member Profile Modal */}
      {activeProfileMember && (
        <MemberProfileModal
          member={activeProfileMember}
          onClose={() => {
            setActiveProfileMember(null);
            if (onClearSelectedMember) onClearSelectedMember();
            reload();
          }}
          onUpdate={() => {
            const updated = db.getMemberById(activeProfileMember.id);
            setActiveProfileMember(updated || null);
            reload();
          }}
        />
      )}

      {editingMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <form onSubmit={handleSaveMember} className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-[8px] border border-line bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-condensed text-base font-bold uppercase">Edit Member · {editingMember.rollNumber}</h3>
              <button type="button" onClick={() => setEditingMember(null)} className="text-muted hover:text-ink" aria-label="Close edit member"><X className="h-4 w-4" /></button>
            </div>
            {editError && <p role="alert" className="mb-3 text-xs text-bad">{editError}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ['fullName', 'Full name'], ['mobileNumber', 'Phone number'], ['whatsappNumber', 'WhatsApp number'],
                ['email', 'Email'], ['fatherName', 'Father name'], ['cnic', 'CNIC'],
                ['registrationDate', 'Admission date'], ['startDate', 'Membership start date'],
                ['emergencyContactName', 'Emergency contact name'],
                ['emergencyContactPhone', 'Emergency contact phone'], ['dateOfBirth', 'Date of birth'],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-[11px] text-muted">{label}
                  <input
                    type={field === 'registrationDate' || field === 'startDate' || field === 'dateOfBirth' ? 'date' : field === 'email' ? 'email' : 'text'}
                    value={editingMember[field] || ''}
                    onChange={(event) => setEditingMember({ ...editingMember, [field]: event.target.value })}
                    className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink"
                  />
                </label>
              ))}
              <label className="text-[11px] text-muted">Membership duration (months)
                <input type="number" min="1" max="120" value={editDurationMonths} onChange={(event) => setEditDurationMonths(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink" />
              </label>
              <label className="text-[11px] text-muted">Membership plan
                <select value={editingMember.planId} onChange={(event) => {
                  const plan = db.getPlans().find((candidate) => candidate.id === event.target.value);
                  if (plan) setEditingMember({ ...editingMember, planId: plan.id, planName: plan.name, monthlyFee: plan.price });
                }} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink">
                  {!db.getPlans().some((plan) => plan.id === editingMember.planId) && <option value={editingMember.planId}>{editingMember.planName}</option>}
                  {db.getPlans().map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-muted">Gender
                <select value={editingMember.gender} onChange={(event) => setEditingMember({ ...editingMember, gender: event.target.value as Member['gender'] })} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink">
                  {['Male', 'Female', 'Other'].map((gender) => <option key={gender}>{gender}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-muted">Blood group
                <select value={editingMember.bloodGroup || ''} onChange={(event) => setEditingMember({ ...editingMember, bloodGroup: (event.target.value || undefined) as BloodGroup | undefined })} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink">
                  <option value="">Not recorded</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-muted sm:col-span-2">Address
                <textarea rows={2} value={editingMember.address || ''} onChange={(event) => setEditingMember({ ...editingMember, address: event.target.value })} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink" />
              </label>
              <label className="text-[11px] text-muted sm:col-span-2">Medical notes / other notes
                <textarea rows={2} value={editingMember.medicalNotes || editingMember.notes || ''} onChange={(event) => setEditingMember({ ...editingMember, medicalNotes: event.target.value })} className="mt-1 w-full rounded-[6px] border border-line bg-app px-3 py-2 text-xs text-ink" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingMember(null)} className="rounded-[6px] border border-line px-3 py-2 text-xs text-muted">Cancel</button>
              <button type="submit" className="rounded-[6px] bg-brand px-3 py-2 text-xs font-bold text-white">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Printable ID Badge */}
      {printBadgeMember && (
        <PrintableMemberCard
          member={printBadgeMember}
          onClose={() => setPrintBadgeMember(null)}
        />
      )}

      {/* Quick Leave Modal */}
      {showQuickRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Find Member to Mark as Left
              </h3>
              <button onClick={() => setShowQuickRemoveModal(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickRemoveSearch}
                onChange={(e) => setQuickRemoveSearch(e.target.value)}
                placeholder="Search member to mark as left..."
                autoFocus
                className="w-full bg-raised border border-line rounded-[6px] pl-8 pr-3 py-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {quickRemoveResults.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-[6px] bg-raised border border-line flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-ink">{m.fullName}</div>
                    <span className="font-mono text-[10px] text-muted">{m.rollNumber} · {m.planName}</span>
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickRemoveModal(false);
                      setMemberToLeave(m);
                    }}
                    className="px-2.5 py-1 rounded-[4px] bg-bad hover:bg-bad-strong text-white text-xs font-semibold cursor-pointer"
                  >
                    Mark Left
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {memberToLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-raised border border-bad/40 flex items-center justify-center text-bad shrink-0">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                  Confirm Member Leaving
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Mark {memberToLeave.fullName} ({memberToLeave.rollNumber}) as left? Their profile and history will be kept.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-raised border border-line text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Plan:</span>
                <span className="text-ink">{memberToLeave.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Balance Due:</span>
                <span className="font-mono text-bad">Rs. {memberToLeave.balanceDue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMemberToLeave(null)}
                className="px-3.5 py-1.5 rounded-[6px] bg-raised hover:bg-hover text-xs font-semibold text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLeaveMember(memberToLeave)}
                className="px-4 py-1.5 rounded-[6px] bg-bad hover:bg-bad-strong text-xs font-bold text-white uppercase tracking-wider cursor-pointer"
              >
                Mark as Left
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
