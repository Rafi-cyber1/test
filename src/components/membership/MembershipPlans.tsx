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
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5 bg-app text-ink">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-20 right-3 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-panel border border-line border-l-4 border-l-ok text-xs font-semibold shadow-xl">
          <Check className="w-4 h-4 text-ok" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-panel border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-ink">
              Membership Plans & Fee Rates (PKR)
            </h2>
            <span className="font-mono text-[11px] text-muted bg-raised px-2 py-0.5 rounded-[4px] border border-line">
              {plans.length} Tiered Packages
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Standard: <strong className="text-ink">Rs. 4,000 (Admission + first month)</strong> · <strong className="text-ink">Rs. 2,000 (monthly)</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToStandard}
            className="px-3 py-1.5 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-muted hover:text-ink transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Reset to Rs. 4,000 Advance & Rs. 2,000 Monthly"
          >
            <RotateCcw className="w-3.5 h-3.5 text-brand" />
            <span>Reset Standard Rates</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-brand"
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
              className={`rounded-[8px] bg-panel border p-4.5 flex flex-col justify-between transition-all duration-150 ${
                p.isActive
                  ? isAdvance
                    ? 'border-brand'
                    : 'border-line hover:border-line-strong'
                  : 'border-line/50 opacity-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between pb-2.5 border-b border-line">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand">
                      {p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} Month
                      {(p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))) === 1 ? '' : 's'}
                      {isAdvance ? ' Admission' : ' Membership'}
                    </span>
                    <h3 className="font-bold text-sm text-ink mt-0.5">{p.name}</h3>
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
                <div className="py-3 border-b border-line">
                  <div className="flex items-baseline gap-2">
                    <span className="font-condensed text-3xl font-bold text-ink tabular-nums">
                      {settings.currency} {p.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted">
                      {isAdvance ? 'Admission + first month' : `/ ${p.durationMonths || Math.max(1, Math.round(p.durationDays / 30))} month(s)`}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                {/* Features */}
                <div className="py-3 space-y-1.5 text-xs text-muted">
                  {(p.features || ['Full gym floor access', 'Locker & workout guidance']).map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Controls */}
              <div className="pt-3 border-t border-line flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                  <Users className="w-3.5 h-3.5 text-muted" />
                  <span><strong className="text-ink">{enrolledCount}</strong> active</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="p-1 text-muted hover:text-ink rounded-[4px] hover:bg-raised cursor-pointer"
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
                      className="p-1 text-muted hover:text-bad rounded-[4px] hover:bg-raised cursor-pointer"
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
          <div className="w-full max-w-md bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Edit Plan — {editingPlan.name}
              </h3>
              <button onClick={() => setEditingPlan(null)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Price Fee (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-ink"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingPlan.durationMonths || Math.max(1, Math.round(editingPlan.durationDays / 30))}
                    onChange={(e) => setEditingPlan({ ...editingPlan, durationMonths: Number(e.target.value), durationDays: Number(e.target.value) * 30 })}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3 py-1.5 rounded-[6px] bg-raised text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-xs font-bold text-white uppercase tracking-wider"
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
          <div className="w-full max-w-md bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
                Create Membership Plan
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Student 1-Month Package"
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Price Fee (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-ink"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newDays}
                    onChange={(e) => setNewDays(Number(e.target.value))}
                    className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Terms, locker access, or shift limits..."
                  className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-raised text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-brand hover:bg-brand-strong text-xs font-bold text-white uppercase tracking-wider"
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
          <div className="w-full max-w-sm bg-panel border border-line rounded-[8px] p-5 space-y-4 shadow-2xl">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Delete Plan {planToDelete.name}?
            </h3>
            <p className="text-xs text-muted">
              Are you sure you want to delete this plan? Existing members enrolled on it will maintain their records.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlanToDelete(null)}
                className="px-3 py-1.5 rounded-[6px] bg-raised text-xs text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlan(planToDelete)}
                className="px-4 py-1.5 rounded-[6px] bg-bad hover:bg-bad-strong text-xs font-bold text-white uppercase tracking-wider"
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
