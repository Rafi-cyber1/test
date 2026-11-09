import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  Building,
  RotateCcw,
  Check,
  FileText,
  Cloud,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { db } from '../../db/storage';
import { GymSettings, ReceptionistProfile } from '../../types';
import { GymTownLogo } from '../common/GymTownLogo';
import {
  CloudStatus,
  checkCloudStatus,
  downloadFromCloud,
  getLastSyncLabel,
  getSyncKey,
  setSyncKey,
  uploadToCloud,
} from '../../services/cloudSync';

export const ApplicationSettings: React.FC = () => {
  const [settings, setSettings] = useState<GymSettings>(db.getSettings());
  const [receptionist, setReceptionist] = useState<ReceptionistProfile>(
    settings.receptionistProfile || {
      name: 'Bilal Tariq',
      phone: '+92 301 9283741',
      shift: 'Morning Shift (06:00 AM - 02:00 PM)',
      counterId: 'Desk 01 - Main Gate',
      notes: 'Front Desk Officer on Duty',
    }
  );

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'receptionist' | 'gym' | 'database' | 'audit'>('receptionist');

  // Optional cloud sync (Vercel serverless endpoint at /api/sync)
  const [syncKeyInput, setSyncKeyInput] = useState(getSyncKey());
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [lastSyncLabel, setLastSyncLabel] = useState(getLastSyncLabel());

  const auditLogs = db.getState().auditLogs;
  const backupCounts = db.getBackupCounts();

  const validatePhoneNumbers = (phones: Array<{ label: string; value: string }>) => {
    const invalidPhone = phones.find(({ value }) => value.trim() && !db.isValidPhoneNumber(value));
    if (invalidPhone) {
      setPhoneError(`${invalidPhone.label} must contain 11 digits, or 12 digits including Pakistan country code 92.`);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleSaveReceptionist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumbers([{ label: 'Contact phone', value: receptionist.phone }])) return;
    db.updateReceptionistProfile(receptionist);
    setSettings(db.getSettings());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveGymSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumbers([
      { label: 'Official contact phone', value: settings.phone },
      { label: 'WhatsApp hotline', value: settings.whatsapp },
      { label: 'Receptionist phone', value: receptionist.phone },
    ])) return;
    db.updateSettings({
      ...settings,
      receptionistProfile: receptionist,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    const json = db.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TheGymTown_Hyderabad_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runCloud = async (task: () => Promise<void>) => {
    setCloudBusy(true);
    try {
      await task();
    } finally {
      setCloudBusy(false);
      setLastSyncLabel(getLastSyncLabel());
    }
  };

  const handleSaveSyncKey = () => runCloud(async () => {
    setSyncKey(syncKeyInput);
    setCloudMessage(null);
    setCloudError(false);
    if (!syncKeyInput.trim()) {
      setCloudStatus(null);
      setCloudMessage('Sync key cleared on this device.');
      return;
    }
    try {
      const status = await checkCloudStatus();
      setCloudStatus(status);
      setCloudMessage(
        status.empty
          ? 'Cloud is connected and empty — upload this desk\'s data first.'
          : `Cloud connected · v${status.version} · saved ${status.updatedAt ? new Date(status.updatedAt).toLocaleString() : 'unknown'} by ${status.updatedBy || 'front desk'}.`
      );
      setCloudError(false);
    } catch (error: any) {
      setCloudStatus(null);
      setCloudMessage(error.message || 'Could not reach the cloud endpoint.');
      setCloudError(true);
    }
  });

  const handleCloudUpload = () => runCloud(async () => {
    const confirmed = window.confirm(
      `Replace the cloud copy with this desk's data?\n\nMembers: ${backupCounts.members} · Ledger entries: ${backupCounts.ledgerEntries} · Receipts: ${backupCounts.payments} · Products: ${backupCounts.products}\n\nA copy of the current cloud data stays in your last export, and the previous upload is always downloadable until this one is replaced.`
    );
    if (!confirmed) return;

    try {
      const status = cloudStatus ?? (await checkCloudStatus());
      setCloudStatus(status);
      const result = await uploadToCloud(
        status.version,
        db.getSettings().receptionistProfile?.name || 'front desk'
      );
      setCloudMessage(result.message);
      setCloudError(!result.success);
      if (result.success) setCloudStatus(await checkCloudStatus());
    } catch (error: any) {
      setCloudMessage(error.message || 'Upload failed.');
      setCloudError(true);
    }
  });

  const handleCloudDownload = () => runCloud(async () => {
    try {
      const status = await checkCloudStatus();
      setCloudStatus(status);
      if (status.empty) {
        setCloudMessage('Cloud is empty — nothing to download yet.');
        setCloudError(true);
        return;
      }
      const confirmed = window.confirm(
        `Download cloud copy v${status.version} (saved ${status.updatedAt ? new Date(status.updatedAt).toLocaleString() : 'unknown'} by ${status.updatedBy || 'front desk'})?\n\nThis REPLACES the data in this browser. Export a backup first if this device has newer work.`
      );
      if (!confirmed) return;

      const result = await downloadFromCloud();
      setSettings(db.getSettings());
      setCloudMessage(result.message);
      setCloudError(!result.success);
    } catch (error: any) {
      setCloudMessage(error.message || 'Download failed.');
      setCloudError(true);
    }
  });

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const res = db.restoreBackupJson(text);
        if (res.success) {
          setRestoreStatus(res.message);
          setSettings(db.getSettings());
          if (db.getSettings().receptionistProfile) {
            setReceptionist(db.getSettings().receptionistProfile);
          }
        } else {
          alert(res.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAllData = () => {
    if (
      confirm(
        'Clear ALL records? This removes members, fee ledger, receipts, attendance, expenses, inventory products, POS sales, stock purchases, and suppliers. Plans and station settings are kept. Export a backup first if you may need this data.'
      )
    ) {
      db.clearAllData();
      setRestoreStatus('All operational records cleared. Plans and station settings were kept.');
      setTimeout(() => setRestoreStatus(null), 4000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5 bg-app text-ink">
      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-panel border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-ink">
              Station Settings & Administration
            </h2>
            <span className="font-mono text-xs text-muted bg-raised px-2 py-0.5 rounded-[4px] border border-line">
              Hyderabad Desk 01
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Manage your Front Desk Receptionist profile, gym location details (Hyderabad, Sindh), and JSON database backup.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-raised border border-line border-l-4 border-l-ok text-ok text-xs font-semibold">
            <Check className="w-3.5 h-3.5" />
            <span>Settings Saved</span>
          </div>
        )}
      </div>

      {/* Underline Tabs */}
      <div className="flex items-center gap-6 px-1 border-b border-line">
        {(
          [
            { key: 'receptionist', label: 'Receptionist Profile' },
            { key: 'gym', label: 'Gym Details & Location' },
            { key: 'database', label: 'Backup & Restore' },
            { key: 'audit', label: `System Audit Log (${auditLogs.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2.5 text-xs font-semibold tracking-wide transition-all cursor-pointer border-b-2 ${
              activeTab === tab.key
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Receptionist Profile */}
      {activeTab === 'receptionist' && (
        <form onSubmit={handleSaveReceptionist} className="p-5 rounded-[8px] bg-panel border border-line space-y-4 max-w-2xl text-xs">
          {phoneError && (
            <div role="alert" className="rounded-[6px] border border-bad/40 bg-bad/10 p-2.5 text-xs text-bad">
              {phoneError}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Front Desk Officer Profile
            </h3>
            <p className="text-muted text-[11px]">
              This name appears on all receipts, turnstile logs, and attendance audits.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Officer Full Name *
              </label>
              <input
                type="text"
                required
                value={receptionist.name}
                onChange={(e) => setReceptionist({ ...receptionist, name: e.target.value })}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                maxLength={16}
                value={receptionist.phone}
                onChange={(e) => {
                  setReceptionist({ ...receptionist, phone: e.target.value });
                  setPhoneError(null);
                }}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink focus:ring-2 focus:ring-brand focus:outline-none"
              />
              <span className="mt-1 block text-[10px] text-muted">11 digits, or 12 digits with country code 92.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Work Shift Timing
              </label>
              <input
                type="text"
                value={receptionist.shift}
                onChange={(e) => setReceptionist({ ...receptionist, shift: e.target.value })}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Counter ID / Gate
              </label>
              <input
                type="text"
                value={receptionist.counterId}
                onChange={(e) => setReceptionist({ ...receptionist, counterId: e.target.value })}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-brand"
            >
              Save Officer Profile
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Gym Details & Location */}
      {activeTab === 'gym' && (
        <form onSubmit={handleSaveGymSettings} className="p-5 rounded-[8px] bg-panel border border-line space-y-4 max-w-2xl text-xs">
          {phoneError && (
            <div role="alert" className="rounded-[6px] border border-bad/40 bg-bad/10 p-2.5 text-xs text-bad">
              {phoneError}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Gym Facility Information
            </h3>
            <p className="text-muted text-[11px]">
              Hyderabad District center branding and contact info printed on customer receipts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Gym Name *
              </label>
              <input
                type="text"
                required
                value={settings.gymName}
                onChange={(e) => setSettings({ ...settings, gymName: e.target.value })}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                City / Region
              </label>
              <input
                type="text"
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
              Address
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                Official Contact Phone
              </label>
              <input
                type="tel"
                maxLength={16}
                value={settings.phone}
                onChange={(e) => {
                  setSettings({ ...settings, phone: e.target.value });
                  setPhoneError(null);
                }}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold block mb-1">
                WhatsApp Hotline
              </label>
              <input
                type="tel"
                maxLength={16}
                value={settings.whatsapp}
                onChange={(e) => {
                  setSettings({ ...settings, whatsapp: e.target.value });
                  setPhoneError(null);
                }}
                className="w-full bg-raised border border-line rounded-[6px] px-3 py-2 text-xs font-mono text-ink"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-line flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-brand"
            >
              Update Gym Info
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Database Backup & Restore */}
      {activeTab === 'database' && (
        <div className="p-5 rounded-[8px] bg-panel border border-line space-y-5 max-w-2xl text-xs">
          <div>
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Database Protection & Backup Snapshot
            </h3>
            <p className="text-muted text-[11px] mt-0.5">
              One JSON file with <strong className="text-ink">everything</strong>: members &amp; removed members, plans,
              fee ledger, receipts, attendance, expenses, inventory products, POS sales, stock purchases, suppliers,
              notifications, station settings, and the audit trail. Restoring it brings every module back exactly as
              it was.
            </p>
          </div>

          {restoreStatus && (
            <div role="status" className={`p-3 rounded-[6px] bg-raised border border-line border-l-4 font-semibold ${
              restoreStatus.startsWith('Unable to')
                ? 'border-l-bad text-bad'
                : 'border-l-ok text-ok'
            }`}>
              {restoreStatus}
            </div>
          )}

          <div className="p-4 rounded-[6px] bg-raised border border-line space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-xs text-ink block">What the next backup will contain</span>
              <span className="text-[10px] font-mono text-muted">schema v3 · full database</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { label: 'Members', value: backupCounts.members },
                { label: 'Removed members', value: backupCounts.removedMembers },
                { label: 'Plans', value: backupCounts.plans },
                { label: 'Fee ledger entries', value: backupCounts.ledgerEntries },
                { label: 'Receipts / payments', value: backupCounts.payments },
                { label: 'Attendance', value: backupCounts.attendance },
                { label: 'Expenses', value: backupCounts.expenses },
                { label: 'Inventory products', value: backupCounts.products },
                { label: 'POS sales', value: backupCounts.sales },
                { label: 'Stock purchases', value: backupCounts.stockPurchases },
                { label: 'Suppliers', value: backupCounts.suppliers },
                { label: 'Notifications', value: backupCounts.notifications },
                { label: 'Audit log entries', value: backupCounts.auditLogs },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-[4px] border border-line bg-panel px-2 py-1.5"
                >
                  <span className="text-[10px] text-muted truncate">{item.label}</span>
                  <span className="font-mono text-[11px] font-bold text-ink tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-[6px] bg-raised border border-line space-y-2">
              <span className="font-semibold text-xs text-ink block">Export Full Backup JSON</span>
              <p className="text-[11px] text-muted">
                Downloads members + inventory + sales + fees in a single file.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full mt-2 py-2 rounded-[6px] bg-panel hover:bg-hover border border-line text-xs font-semibold text-ink flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Full Backup</span>
              </button>
            </div>

            <div className="p-4 rounded-[6px] bg-raised border border-line space-y-2">
              <span className="font-semibold text-xs text-ink block">Restore from Backup</span>
              <p className="text-[11px] text-muted">
                Replaces the current data with the full contents of the chosen file.
              </p>
              <label className="w-full mt-2 py-2 rounded-[6px] bg-panel hover:bg-hover border border-line text-xs font-semibold text-ink flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Backup File</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          {/* Optional cloud sync — Vercel serverless endpoint in api/sync.ts */}
          <div className="pt-4 border-t border-line space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-semibold text-xs text-ink flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-brand" />
                  <span>Cloud Sync (desk + phone)</span>
                </span>
                <p className="text-[11px] text-muted mt-1 max-w-xl">
                  Optional. Upload this desk&apos;s full database to your Vercel endpoint and download it on
                  another device. Nothing is uploaded until you press Upload.
                </p>
                <p className="text-[10px] text-muted mt-1 max-w-xl">
                  Runs on the Vercel deployment (or with <span className="font-mono">vercel dev</span>) — the
                  plain <span className="font-mono">npm run dev</span> preview has no <span className="font-mono">/api</span> functions,
                  where this card will report “endpoint not found”.
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-[4px] font-semibold ${
                cloudStatus && !cloudStatus.empty ? 'status-pill-success' : cloudStatus ? 'status-pill-warning' : 'status-pill-neutral'
              }`}>
                {cloudStatus
                  ? cloudStatus.empty
                    ? 'Connected · empty'
                    : `Connected · v${cloudStatus.version}`
                  : 'Not connected'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={syncKeyInput}
                  onChange={(event) => setSyncKeyInput(event.target.value)}
                  placeholder="Sync key (SYNC_SECRET set in Vercel)"
                  className="w-full bg-raised border border-line rounded-[6px] pl-8 pr-3 py-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:outline-none"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveSyncKey}
                disabled={cloudBusy}
                className="px-3.5 py-2 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudBusy ? 'animate-spin' : ''}`} />
                <span>Save &amp; test</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCloudUpload}
                disabled={cloudBusy}
                className="py-2 rounded-[6px] bg-brand hover:bg-brand-strong text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload to cloud</span>
              </button>
              <button
                type="button"
                onClick={handleCloudDownload}
                disabled={cloudBusy}
                className="py-2 rounded-[6px] bg-raised hover:bg-hover border border-line text-xs font-semibold text-ink flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download from cloud</span>
              </button>
            </div>

            {cloudMessage && (
              <p className={`text-[11px] flex items-start gap-1.5 ${cloudError ? 'text-bad' : 'text-ok'}`}>
                {cloudError ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                )}
                <span>{cloudMessage}</span>
              </p>
            )}

            {lastSyncLabel && (
              <p className="text-[10px] text-muted font-mono">Last cloud sync on this device — {lastSyncLabel}</p>
            )}
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <div>
              <span className="font-semibold text-xs text-bad block">Clear All Records</span>
              <span className="text-[11px] text-muted">
                Removes members, fees, receipts, attendance, expenses, inventory, sales, purchases, and suppliers.
                Plans and station settings are kept.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="px-3.5 py-1.5 rounded-[6px] bg-raised hover:bg-bad hover:text-white border border-bad/40 text-bad text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Database
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: System Audit Log */}
      {activeTab === 'audit' && (
        <div className="border border-line rounded-[8px] bg-panel overflow-hidden">
          <div className="p-3.5 border-b border-line flex items-center justify-between">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-ink">
              Audit Log Ledger ({auditLogs.length})
            </h3>
            <span className="text-xs text-muted">Immutable security trail</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line bg-raised text-muted text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Module</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Details</th>
                  <th className="py-2.5 px-4 font-semibold">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditLogs.slice(0, 80).map((log) => (
                  <tr key={log.id} className="h-11 hover:bg-raised/50 transition-colors">
                    <td className="py-2 px-4 font-mono text-muted text-[11px]">
                      {log.timestamp.split('T')[0]} {log.timestamp.split('T')[1]?.substring(0, 5)}
                    </td>
                    <td className="py-2 px-4">
                      <span className="status-pill-neutral text-[10px]">{log.module}</span>
                    </td>
                    <td className="py-2 px-4 font-medium text-ink">{log.action}</td>
                    <td className="py-2 px-4 text-muted truncate max-w-md">{log.details}</td>
                    <td className="py-2 px-4 text-muted font-mono">{log.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
