import React, { useState } from 'react';
import { Layers, Plus, Edit2, Check, X, Users, RotateCcw, Trash2 } from 'lucide-react';
import { db } from '../../db/storage';
import { MembershipPlan } from '../../types';

export const MembershipPlans: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlan[]>(db.getPlans());
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<MembershipPlan | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New plan form state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number>(2000);
  const [newDays, setNewDays] = useState<number>(1);
  const [newDesc, setNewDesc] = useState('');

  const members = db.getMembers();
  const settings = db.getSettings();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reloadPlans = () => {
    setPlans([...db.getPlans()]);
  };

  const handleToggleActive = (plan: MembershipPlan) => {
    db.updatePlan(plan.id, { isActive: !plan.isActive });
    reloadPlans();
    showToast(`Plan ${plan.name} is now ${!plan.isActive ? 'Active' : 'Inactive'}`);
  };

  const handleResetToStandard = () => {
    if (confirm('Reset all packages to the official The Gym Town rate: Rs. 4,000 (With Advance) and Rs. 2,000 (Monthly Fee)?')) {
      db.resetPlansToDefault();
      reloadPlans();
      showToast('All plans reset to Rs. 4,000 Advance & Rs. 2,000 Monthly structure');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    db.updatePlan(editingPlan.id, {
      name: editingPlan.name.trim(),
      price: Number(editingPlan.price) || 0,
      durationDays: (Number(editingPlan.durationMonths) || Math.max(1, Math.round(editingPlan.durationDays / 30))) * 30,
      durationMonths: Number(editingPlan.durationMonths) || Math.max(1, Math.round(editingPlan.durationDays / 30)),
      description: editingPlan.description?.trim(),
    });
    setEditingPlan(null);
    reloadPlans();
    showToast('Plan updated successfully');
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !Number.isFinite(newPrice) || newPrice <= 0 || !Number.isFinite(newDays) || newDays <= 0) return;

    db.addPlan({
      name: newName.trim(),
      price: Number(newPrice) || 0,
      durationDays: (Number(newDays) || 1) * 30,
      durationMonths: Number(newDays) || 1,
      description: newDesc.trim() || 'Gym floor & equipment access',
      isActive: true,
      trainingType: 'CUSTOM',
      features: [],
    });

    setShowNewModal(false);
    setNewName('');
    setNewPrice(2000);
    setNewDays(1);
    setNewDesc('');
    reloadPlans();
    showToast('New membership package created');
  };

  const handleDeletePlan = (plan: MembershipPlan) => {
    db.deletePlan(plan.id);
    setPlanToDelete(null);
    reloadPlans();
    showToast(`Plan ${plan.name} deleted`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0D0E10] text-[#ECEAE6]">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#15171A] border border-[#262A30] border-l-4 border-l-[#3DB88B] text-xs font-semibold shadow-xl">
          <Check className="w-4 h-4 text-[#3DB88B]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
              Membership Plans & Fee Rates (PKR)
            </h2>
            <span className="font-mono text-[11px] text-[#8B909A] bg-[#1C1F23] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
              {plans.length} Tiered Packages
            </span>
          </div>
          <p className="text-xs text-[#8B909A] mt-1">
            Standard: <strong className="text-[#ECEAE6]">Rs. 4,000 (Admission + first month)</strong> · <strong className="text-[#ECEAE6]">Rs. 2,000 (monthly)</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToStandard}
            className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#8B909A] hover:text-[#ECEAE6] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset to Rs. 4,000 Advance & Rs. 2,000 Monthly"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#D9383A]" />
            <span>Reset Standard Rates</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {/* Plans Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => {
          const enrolledCount = members.filter((m) => m.planId === p.id && m.status === 'ACTIVE').length;
          const isAdvance = p.id.startsWith('plan_admission');
          const isMonthly = p.trainingType === 'CARDIO' || p.trainingType === 'MUSCLE_BUILDING';

          return (
            <div
              key={p.id}
              className={`rounded-[8px] bg-[#15171A] border p-4.5 flex flex-col justify-between transition-all duration-150 ${
                p.isActive
                  ? isAdvance
                    ? 'border-[#D9383A]'
                    : 'border-[#262A30] hover:border-[#363B44]'
                  : 'border-[#262A30]/50 opacity-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between pb-2.5 border-b border-[#262A30]">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#D9383A]">
                      {p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} Month
                      {(p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))) === 1 ? '' : 's'}
                      {isAdvance ? ' Admission' : ' Membership'}
                    </span>
                    <h3 className="font-bold text-sm text-[#ECEAE6] mt-0.5">{p.name}</h3>
                  </div>

                  {isAdvance && (
                    <span className="status-pill-danger text-[10px]">
                      New Enrollees
                    </span>
                  )}
                  {isMonthly && !isAdvance && (
                    <span className="status-pill-neutral text-[10px]">
                      Regular Monthly
                    </span>
                  )}
                </div>

                {/* Price Display */}
                <div className="py-3 border-b border-[#262A30]">
                  <div className="flex items-baseline gap-2">
                    <span className="font-condensed text-3xl font-bold text-[#ECEAE6] tabular-nums">
                      {settings.currency} {p.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#8B909A]">
                      {isAdvance ? 'Admission + first month' : `/ ${p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} month(s)`}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B909A] mt-1.5 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                {/* Features */}
                <div className="py-3 space-y-1.5 text-xs text-[#8B909A]">
                  {(p.features || ['Full gym floor access', 'Locker & workout guidance']).map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Controls */}
              <div className="pt-3 border-t border-[#262A30] flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-1.5 text-[#8B909A] font-mono text-[11px]">
                  <Users className="w-3.5 h-3.5 text-[#8B909A]" />
                  <span><strong className="text-[#ECEAE6]">{enrolledCount}</strong> active</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] hover:bg-[#1C1F23] cursor-pointer"
                    title="Edit Rate or Days"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold border transition-colors cursor-pointer ${
                      p.isActive
                        ? 'status-pill-success'
                        : 'status-pill-neutral'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Inactive'}
                  </button>

                  {!isAdvance && !isMonthly && (
                    <button
                      onClick={() => setPlanToDelete(p)}
                      className="p-1 text-[#8B909A] hover:text-[#E5484D] rounded-[4px] hover:bg-[#1C1F23] cursor-pointer"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-[#15171A] border border-[#262A30] rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262A30]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                Edit Plan — {editingPlan.name}
              </h3>
              <button onClick={() => setEditingPlan(null)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Price Fee (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingPlan.durationMonths || Math.max(1, Math.round(editingPlan.durationDays / 30))}
                    onChange={(e) => setEditingPlan({ ...editingPlan, durationMonths: Number(e.target.value), durationDays: Number(e.target.value) * 30 })}
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                />
              </div>

              <div className="pt-3 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] text-xs font-semibold text-[#ECEAE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-[#15171A] border border-[#262A30] rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262A30]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                Create Membership Plan
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Student 1-Month Package"
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Price Fee (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newDays}
                    onChange={(e) => setNewDays(Number(e.target.value))}
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Terms, locker access, or shift limits..."
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                />
              </div>

              <div className="pt-3 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] text-xs font-semibold text-[#ECEAE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-[#15171A] border border-[#262A30] rounded-[8px] p-5 space-y-4 shadow-2xl">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
              Delete Plan {planToDelete.name}?
            </h3>
            <p className="text-xs text-[#8B909A]">
              Are you sure you want to delete this plan? Existing members enrolled on it will maintain their records.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlanToDelete(null)}
                className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] text-xs text-[#ECEAE6]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlan(planToDelete)}
                className="px-4 py-1.5 rounded-[6px] bg-[#E5484D] hover:bg-[#D1383C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
