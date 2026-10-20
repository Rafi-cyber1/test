import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Shield, Phone, Calendar, User } from 'lucide-react';
import { Member } from '../../types';
import { db } from '../../db/storage';
import { GymTownLogo } from '../common/GymTownLogo';

interface PrintableMemberCardProps {
  member: Member;
  onClose: () => void;
}

export const PrintableMemberCard: React.FC<PrintableMemberCardProps> = ({ member, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const settings = db.getSettings();

  useEffect(() => {
    // Generate high-resolution scannable QR Code containing the member's Roll Number
    QRCode.toDataURL(member.rollNumber, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [member.rollNumber]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0c121e] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Digital Member Pass & Badge</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Badge</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Card Container */}
        <div className="p-6 flex justify-center bg-slate-950/60">
          <div
            id="printable-badge"
            className="w-80 rounded-2xl bg-gradient-to-br from-[#070b14] via-[#0d1627] to-[#080d1a] border border-blue-500/40 p-5 text-white shadow-2xl relative overflow-hidden print-id-card"
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" />

            {/* Header: Gym Town Branding */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <GymTownLogo size="xs" />
                  <span className="font-extrabold text-sm tracking-wider uppercase text-white">
                    {settings.gymName}
                  </span>
                </div>
                <div className="text-[9px] text-blue-300 font-medium tracking-wider uppercase mt-0.5">
                  Official Athletic ID Pass
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-semibold">
                  {member.planName}
                </span>
              </div>
            </div>

            {/* Member Details & Photo */}
            <div className="py-4 flex gap-4 items-center">
              {/* Photo Frame */}
              <div className="w-20 h-24 rounded-xl bg-slate-800 border-2 border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <User className="w-8 h-8 text-slate-400" />
                    <span className="text-[8px] mt-1 text-slate-400 uppercase font-semibold">Photo</span>
                  </div>
                )}
              </div>

              {/* Bio info */}
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-white truncate leading-tight">
                  {member.fullName}
                </div>
                <div className="text-[11px] font-mono text-blue-400 font-bold tracking-wider mt-0.5">
                  {member.rollNumber}
                </div>

                <div className="mt-2 space-y-1 text-[10px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{member.mobileNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Valid until: <strong className="text-white font-mono">{member.expiryDate}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code and Barcode Section */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-[9px] text-slate-400 uppercase font-medium">Front Desk Verification</div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <Shield className="w-3 h-3" />
                  <span>Official Gym Member</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  Emergency: {member.emergencyContactPhone}
                </div>
              </div>

              {/* Real QR Code image */}
              <div className="w-16 h-16 bg-white p-1 rounded-lg shadow-sm shrink-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Member QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-200 animate-pulse" />
                )}
              </div>
            </div>

            {/* Bottom barcode decoration */}
            <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-col items-center">
              <div className="font-mono text-[9px] tracking-widest text-slate-400">
                ||||||||| | ||||| |||| |||||||| |||||| ||||
              </div>
              <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                {member.rollNumber} · SECURE-VERIFIED
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#090d16] border-t border-slate-800 text-center no-print">
          <p className="text-[11px] text-slate-400">
            Present this card or Member Roll # at the front reception counter for attendance check-in.
          </p>
        </div>
      </div>
    </div>
  );
};
