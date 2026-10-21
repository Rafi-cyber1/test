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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0D0E10] text-[#ECEAE6]">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[6px] bg-[#15171A] border border-[#262A30] border-l-4 border-l-[#3DB88B] text-xs font-semibold shadow-xl">
          <Check className="w-4 h-4 text-[#3DB88B]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="p-3.5 border-b border-[#262A30] bg-[#15171A] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-2.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, Roll #, mobile, or CNIC..."
              className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-1.5 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B909A] hover:text-[#ECEAE6]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#1C1F23] p-0.5 rounded-[6px] border border-[#262A30] text-xs">
            {([
              { key: false, label: `Active Members (${allMembers.length})` },
              { key: true, label: `Removed Members (${removedMembers.length})` },
            ]).map((tab) => (
              <button
                key={String(tab.key)}
                onClick={() => { setShowRemovedMembers(tab.key); setStatusFilter('ALL'); }}
                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium whitespace-nowrap ${showRemovedMembers === tab.key ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold' : 'text-[#8B909A] hover:text-[#ECEAE6]'}`}
              >{tab.label}</button>
            ))}
          </div>

          {!showRemovedMembers && <div className="flex items-center gap-1 bg-[#1C1F23] p-0.5 rounded-[6px] border border-[#262A30] text-xs">
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
                    ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                    : 'text-[#8B909A] hover:text-[#ECEAE6]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!showRemovedMembers && allMembers.length > 0 && (
            <button
              onClick={() => setShowQuickRemoveModal(true)}
              className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#8B909A] hover:text-[#E5484D] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Mark Member as Left</span>
            </button>
          )}

          {!showRemovedMembers && onOpenMonthlyRenewal && (
            <button
              onClick={() => onOpenMonthlyRenewal()}
              className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#ECEAE6] hover:border-[#D9383A] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Renew Monthly Fee by Member Unique ID (the-gym-town-01)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D9383A]" />
              <span>Renew Fee</span>
            </button>
          )}

          {!showRemovedMembers && <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Enroll Member</span>
          </button>}
        </div>
      </div>

      {/* Main Table: Sticky header, 44px rows, 1px dividers, row hover highlight */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#1C1F23] border-b border-[#262A30] text-[#8B909A] text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Roll #</th>
              <th className="py-2.5 px-4 font-semibold">Member Name</th>
              <th className="py-2.5 px-4 font-semibold">Package Plan</th>
              <th className="py-2.5 px-4 font-semibold">Start Date</th>
              <th className="py-2.5 px-4 font-semibold">Expiry Date</th>
              <th className="py-2.5 px-4 font-semibold text-right">Fee Status</th>
              <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#262A30]">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#8B909A] text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 text-[#262A30] stroke-[1.5]" />
                  <p className="text-[#ECEAE6] font-medium">No members found</p>
                  <p className="text-[11px] text-[#8B909A] mt-0.5">
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
                    className="h-11 hover:bg-[#1C1F23]/60 transition-colors cursor-pointer group"
                    onClick={() => setActiveProfileMember(m)}
                  >
                    <td className="py-2 px-4 font-mono font-bold text-[#ECEAE6] tabular-nums">
                      {m.rollNumber}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1C1F23] border border-[#262A30] flex items-center justify-center shrink-0 text-[#ECEAE6] font-condensed font-bold text-xs tracking-wider">
                          {m.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#ECEAE6] group-hover:text-[#D9383A] transition-colors truncate">
                            {m.fullName}
                          </div>
                          <span className="font-mono text-[10px] text-[#8B909A]">{m.mobileNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-[#8B909A] truncate max-w-[140px]">{m.planName}</td>
                    <td className="py-2 px-4 font-mono text-[#8B909A] tabular-nums">{m.startDate}</td>
                    <td className="py-2 px-4 font-mono text-[#ECEAE6] tabular-nums">{m.expiryDate}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums">
                      {m.balanceDue > 0 ? (
                        <span className="text-[#E5484D] font-bold">Due: Rs. {m.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="text-[#3DB88B] font-semibold">Cleared</span>
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
                          className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] hover:bg-[#1C1F23] cursor-pointer"
                          title="Edit member information"
                        ><UserRoundPen className="w-3.5 h-3.5" /></button>}
                        {showRemovedMembers && <button
                          onClick={() => {
                            if (db.restoreMember(m.id)) {
                              showToast(`${m.fullName} restored to the active directory`);
                              reload();
                            }
                          }}
                          className="px-2 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[11px] text-[#3DB88B] cursor-pointer flex items-center gap-1"
                        ><ArchiveRestore className="w-3 h-3" /> Restore</button>}
                        {!showRemovedMembers && <>
                        <button
                          onClick={() => setActiveProfileMember(m)}
                          className="px-2 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[11px] text-[#ECEAE6] cursor-pointer"
                        >
                          Profile
                        </button>

                        {onOpenMonthlyRenewal && (
                          <button
                            onClick={() => onOpenMonthlyRenewal(m.rollNumber)}
                            className="px-2 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#D9383A] hover:text-[#ECEAE6] border border-[#262A30] text-[11px] text-[#ECEAE6] font-semibold cursor-pointer transition-colors"
                            title={`Renew ${m.fullName} (${m.rollNumber})`}
                          >
                            Renew
                          </button>
                        )}

                        {m.balanceDue > 0 && onOpenQuickPaymentForMember && (
                          <button
                            onClick={() => onOpenQuickPaymentForMember(m)}
                            className="px-2 py-1 rounded-[4px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-[11px] font-semibold cursor-pointer"
                          >
                            Collect
                          </button>
                        )}

                        <button
                          onClick={() => setMemberToLeave(m)}
                          className="p-1 text-[#8B909A] hover:text-[#E5484D] rounded-[4px] hover:bg-[#1C1F23] cursor-pointer transition-colors"
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
          <form onSubmit={handleSaveMember} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[8px] border border-[#262A30] bg-[#15171A] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#262A30] pb-3">
              <h3 className="font-condensed text-base font-bold uppercase">Edit Member · {editingMember.rollNumber}</h3>
              <button type="button" onClick={() => setEditingMember(null)} className="text-[#8B909A] hover:text-[#ECEAE6]" aria-label="Close edit member"><X className="h-4 w-4" /></button>
            </div>
            {editError && <p role="alert" className="mb-3 text-xs text-[#E5484D]">{editError}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ['fullName', 'Full name'], ['mobileNumber', 'Phone number'], ['whatsappNumber', 'WhatsApp number'],
                ['email', 'Email'], ['fatherName', 'Father name'], ['cnic', 'CNIC'],
                ['registrationDate', 'Admission date'], ['startDate', 'Membership start date'],
                ['emergencyContactName', 'Emergency contact name'],
                ['emergencyContactPhone', 'Emergency contact phone'], ['dateOfBirth', 'Date of birth'],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-[11px] text-[#8B909A]">{label}
                  <input
                    type={field === 'registrationDate' || field === 'startDate' || field === 'dateOfBirth' ? 'date' : field === 'email' ? 'email' : 'text'}
                    value={editingMember[field] || ''}
                    onChange={(event) => setEditingMember({ ...editingMember, [field]: event.target.value })}
                    className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]"
                  />
                </label>
              ))}
              <label className="text-[11px] text-[#8B909A]">Membership duration (months)
                <input type="number" min="1" max="120" value={editDurationMonths} onChange={(event) => setEditDurationMonths(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]" />
              </label>
              <label className="text-[11px] text-[#8B909A]">Membership plan
                <select value={editingMember.planId} onChange={(event) => {
                  const plan = db.getPlans().find((candidate) => candidate.id === event.target.value);
                  if (plan) setEditingMember({ ...editingMember, planId: plan.id, planName: plan.name, monthlyFee: plan.price });
                }} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]">
                  {!db.getPlans().some((plan) => plan.id === editingMember.planId) && <option value={editingMember.planId}>{editingMember.planName}</option>}
                  {db.getPlans().map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-[#8B909A]">Gender
                <select value={editingMember.gender} onChange={(event) => setEditingMember({ ...editingMember, gender: event.target.value as Member['gender'] })} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]">
                  {['Male', 'Female', 'Other'].map((gender) => <option key={gender}>{gender}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-[#8B909A]">Blood group
                <select value={editingMember.bloodGroup || ''} onChange={(event) => setEditingMember({ ...editingMember, bloodGroup: (event.target.value || undefined) as BloodGroup | undefined })} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]">
                  <option value="">Not recorded</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-[#8B909A] sm:col-span-2">Address
                <textarea rows={2} value={editingMember.address || ''} onChange={(event) => setEditingMember({ ...editingMember, address: event.target.value })} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]" />
              </label>
              <label className="text-[11px] text-[#8B909A] sm:col-span-2">Medical notes / other notes
                <textarea rows={2} value={editingMember.medicalNotes || editingMember.notes || ''} onChange={(event) => setEditingMember({ ...editingMember, medicalNotes: event.target.value })} className="mt-1 w-full rounded-[6px] border border-[#262A30] bg-[#0D0E10] px-3 py-2 text-xs text-[#ECEAE6]" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingMember(null)} className="rounded-[6px] border border-[#262A30] px-3 py-2 text-xs text-[#8B909A]">Cancel</button>
              <button type="submit" className="rounded-[6px] bg-[#D9383A] px-3 py-2 text-xs font-bold text-white">Save Changes</button>
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
          <div className="w-full max-w-md bg-[#15171A] border border-[#262A30] rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262A30]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                Find Member to Mark as Left
              </h3>
              <button onClick={() => setShowQuickRemoveModal(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickRemoveSearch}
                onChange={(e) => setQuickRemoveSearch(e.target.value)}
                placeholder="Search member to mark as left..."
                autoFocus
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {quickRemoveResults.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-[6px] bg-[#1C1F23] border border-[#262A30] flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-[#ECEAE6]">{m.fullName}</div>
                    <span className="font-mono text-[10px] text-[#8B909A]">{m.rollNumber} · {m.planName}</span>
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickRemoveModal(false);
                      setMemberToLeave(m);
                    }}
                    className="px-2.5 py-1 rounded-[4px] bg-[#E5484D] hover:bg-[#D1383C] text-[#ECEAE6] text-xs font-semibold cursor-pointer"
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
          <div className="w-full max-w-sm bg-[#15171A] border border-[#262A30] rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-[#1C1F23] border border-[#E5484D]/40 flex items-center justify-center text-[#E5484D] shrink-0">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                  Confirm Member Leaving
                </h3>
                <p className="text-xs text-[#8B909A] mt-0.5">
                  Mark {memberToLeave.fullName} ({memberToLeave.rollNumber}) as left? Their profile and history will be kept.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-[6px] bg-[#1C1F23] border border-[#262A30] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8B909A]">Plan:</span>
                <span className="text-[#ECEAE6]">{memberToLeave.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B909A]">Balance Due:</span>
                <span className="font-mono text-[#E5484D]">Rs. {memberToLeave.balanceDue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMemberToLeave(null)}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] text-xs font-semibold text-[#ECEAE6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLeaveMember(memberToLeave)}
                className="px-4 py-1.5 rounded-[6px] bg-[#E5484D] hover:bg-[#D1383C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider cursor-pointer"
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
