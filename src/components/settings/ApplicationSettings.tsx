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
} from 'lucide-react';
import { db } from '../../db/storage';
import { GymSettings, ReceptionistProfile } from '../../types';
import { GymTownLogo } from '../common/GymTownLogo';

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

  const auditLogs = db.getState().auditLogs;

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
        'Are you sure you want to clear all data? This will remove all registered members, attendance logs, and payments for a clean slate.'
      )
    ) {
      db.clearAllData();
      setRestoreStatus('All data cleared. Database is 100% fresh with zero records.');
      setTimeout(() => setRestoreStatus(null), 4000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#0D0E10] text-[#ECEAE6]">
      {/* Top Header */}
      <div className="p-4 rounded-[8px] bg-[#15171A] border border-[#262A30] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
              Station Settings & Administration
            </h2>
            <span className="font-mono text-xs text-[#8B909A] bg-[#1C1F23] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
              Hyderabad Desk 01
            </span>
          </div>
          <p className="text-xs text-[#8B909A] mt-1">
            Manage your Front Desk Receptionist profile, gym location details (Hyderabad, Sindh), and JSON database backup.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1C1F23] border border-[#262A30] border-l-4 border-l-[#3DB88B] text-[#3DB88B] text-xs font-semibold">
            <Check className="w-3.5 h-3.5" />
            <span>Settings Saved</span>
          </div>
        )}
      </div>

      {/* Underline Tabs */}
      <div className="flex items-center gap-6 px-1 border-b border-[#262A30]">
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
                ? 'border-[#D9383A] text-[#ECEAE6]'
                : 'border-transparent text-[#8B909A] hover:text-[#ECEAE6]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Receptionist Profile */}
      {activeTab === 'receptionist' && (
        <form onSubmit={handleSaveReceptionist} className="p-5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-4 max-w-2xl text-xs">
          {phoneError && (
            <div role="alert" className="rounded-[6px] border border-[#E5484D]/40 bg-[#E5484D]/10 p-2.5 text-xs text-[#E5484D]">
              {phoneError}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
              Front Desk Officer Profile
            </h3>
            <p className="text-[#8B909A] text-[11px]">
              This name appears on all receipts, turnstile logs, and attendance audits.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                Officer Full Name *
              </label>
              <input
                type="text"
                required
                value={receptionist.name}
                onChange={(e) => setReceptionist({ ...receptionist, name: e.target.value })}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
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
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
              <span className="mt-1 block text-[10px] text-[#8B909A]">11 digits, or 12 digits with country code 92.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                Work Shift Timing
              </label>
              <input
                type="text"
                value={receptionist.shift}
                onChange={(e) => setReceptionist({ ...receptionist, shift: e.target.value })}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                Counter ID / Gate
              </label>
              <input
                type="text"
                value={receptionist.counterId}
                onChange={(e) => setReceptionist({ ...receptionist, counterId: e.target.value })}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#262A30] flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
            >
              Save Officer Profile
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Gym Details & Location */}
      {activeTab === 'gym' && (
        <form onSubmit={handleSaveGymSettings} className="p-5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-4 max-w-2xl text-xs">
          {phoneError && (
            <div role="alert" className="rounded-[6px] border border-[#E5484D]/40 bg-[#E5484D]/10 p-2.5 text-xs text-[#E5484D]">
              {phoneError}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
              Gym Facility Information
            </h3>
            <p className="text-[#8B909A] text-[11px]">
              Hyderabad District center branding and contact info printed on customer receipts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                Gym Name *
              </label>
              <input
                type="text"
                required
                value={settings.gymName}
                onChange={(e) => setSettings({ ...settings, gymName: e.target.value })}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                City / Region
              </label>
              <input
                type="text"
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
              Address
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
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
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6]"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
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
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#262A30] flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
            >
              Update Gym Info
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Database Backup & Restore */}
      {activeTab === 'database' && (
        <div className="p-5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-5 max-w-2xl text-xs">
          <div>
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
              Database Protection & Backup Snapshot
            </h3>
            <p className="text-[#8B909A] text-[11px] mt-0.5">
              Export all members, attendance records, inventory stock, sales invoices, and ledger receipts to a secure JSON file.
            </p>
          </div>

          {restoreStatus && (
            <div className="p-3 rounded-[6px] bg-[#1C1F23] border border-[#262A30] border-l-4 border-l-[#3DB88B] text-[#3DB88B] font-semibold">
              {restoreStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-[6px] bg-[#1C1F23] border border-[#262A30] space-y-2">
              <span className="font-semibold text-xs text-[#ECEAE6] block">Export Backup JSON</span>
              <p className="text-[11px] text-[#8B909A]">
                Download complete snapshot to local disk.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full mt-2 py-2 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#ECEAE6] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Backup</span>
              </button>
            </div>

            <div className="p-4 rounded-[6px] bg-[#1C1F23] border border-[#262A30] space-y-2">
              <span className="font-semibold text-xs text-[#ECEAE6] block">Restore from Backup</span>
              <p className="text-[11px] text-[#8B909A]">
                Load an existing backup JSON file into database.
              </p>
              <label className="w-full mt-2 py-2 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#ECEAE6] flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Backup File</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-[#262A30] flex items-center justify-between">
            <div>
              <span className="font-semibold text-xs text-[#E5484D] block">Clear All Records</span>
              <span className="text-[11px] text-[#8B909A]">Reset members and transactions to zero for a clean start.</span>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="px-3.5 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#E5484D] hover:text-[#ECEAE6] border border-[#E5484D]/40 text-[#E5484D] text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Database
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: System Audit Log */}
      {activeTab === 'audit' && (
        <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
          <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
            <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
              Audit Log Ledger ({auditLogs.length})
            </h3>
            <span className="text-xs text-[#8B909A]">Immutable security trail</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Module</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Details</th>
                  <th className="py-2.5 px-4 font-semibold">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A30]">
                {auditLogs.slice(0, 80).map((log) => (
                  <tr key={log.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                    <td className="py-2 px-4 font-mono text-[#8B909A] text-[11px]">
                      {log.timestamp.split('T')[0]} {log.timestamp.split('T')[1]?.substring(0, 5)}
                    </td>
                    <td className="py-2 px-4">
                      <span className="status-pill-neutral text-[10px]">{log.module}</span>
                    </td>
                    <td className="py-2 px-4 font-medium text-[#ECEAE6]">{log.action}</td>
                    <td className="py-2 px-4 text-[#8B909A] truncate max-w-md">{log.details}</td>
                    <td className="py-2 px-4 text-[#8B909A] font-mono">{log.username}</td>
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
