import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, AlertCircle, CheckCircle2, User, Sparkles, CreditCard } from 'lucide-react';
import { addCalendarMonths, db } from '../../db/storage';
import { BloodGroup, Member, MembershipPlan, PaymentMethod, PaymentRecord } from '../../types';
import { GymTownLogo } from '../common/GymTownLogo';

interface NewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberCreated: (payment?: PaymentRecord) => void;
}

export const NewMemberModal: React.FC<NewMemberModalProps> = ({
  isOpen,
  onClose,
  onMemberCreated,
}) => {
  const plans = db.getPlans().filter(
    (p) => p.isActive && (p.trainingType === 'CARDIO' || p.trainingType === 'MUSCLE_BUILDING')
  );
  const nextRoll = db.generateNextRollNumber();

  const defaultPlan = plans.find((p) => p.id === 'plan_admission_advance') || plans[0];

  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState(nextRoll);
  const [mobileNumber, setMobileNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlan?.id || '');

  // Separate editable fee fields as requested by rule #2
  const [admissionFee, setAdmissionFee] = useState<number>(2000);
  const [regularFee, setRegularFee] = useState<number>(2000);
  const [billingMonths, setBillingMonths] = useState(1);
  const [customPlanName, setCustomPlanName] = useState('Custom Membership');
  const [paidAmount, setPaidAmount] = useState<number>(4000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Optional fields
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [cnic, setCnic] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Camera
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Validation
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [returningMember, setReturningMember] = useState<Member | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || defaultPlan || plans[0];

  const isCustomPlan = selectedPlanId === 'custom';
  const calculatedTotalFee = (Number(admissionFee) || 0)
    + (Number(regularFee) || 0) * (isCustomPlan ? billingMonths : 1);

  // Auto-calculate expiry date
  const calculateExpiry = (start: string, plan: MembershipPlan | undefined, months = 1): string => {
    const durationMonths = plan?.durationMonths || (plan ? Math.max(1, Math.round(plan.durationDays / 30)) : months);
    return addCalendarMonths(start, durationMonths);
  };

  const expiryDate = isCustomPlan
    ? addCalendarMonths(startDate, billingMonths)
    : calculateExpiry(startDate, selectedPlan);

  // When plan changes, update fee defaults
  const handleSelectPlan = (plan: MembershipPlan) => {
    setSelectedPlanId(plan.id);
    if (plan.id.startsWith('plan_admission')) {
      setAdmissionFee(2000);
      setRegularFee(2000);
      setPaidAmount(4000);
      setBillingMonths(1);
    } else {
      setAdmissionFee(0);
      setRegularFee(plan.price);
      setPaidAmount(plan.price);
      setBillingMonths(1);
    }
  };

  const handleSelectCustomPlan = () => {
    setSelectedPlanId('custom');
    setAdmissionFee(0);
    setRegularFee(2000);
    setBillingMonths(1);
    setPaidAmount(2000);
  };

  // Sync WhatsApp with Mobile by default
  const handleMobileChange = (val: string) => {
    setMobileNumber(val);
    if (!whatsappNumber || whatsappNumber === mobileNumber) {
      setWhatsappNumber(val);
    }

    const existingMember = db.getMemberByPhone(val);
    if (existingMember?.archived) {
      setReturningMember(existingMember);
      setFullName(existingMember.fullName);
      setRollNumber(existingMember.rollNumber);
      setWhatsappNumber(existingMember.whatsappNumber);
      setFatherName(existingMember.fatherName || '');
      setGender(existingMember.gender);
      setBloodGroup(existingMember.bloodGroup || '');
      setCnic(existingMember.cnic || '');
      setDateOfBirth(existingMember.dateOfBirth || '');
      setAddress(existingMember.address || '');
      setEmergencyName(existingMember.emergencyContactName || '');
      setEmergencyPhone(existingMember.emergencyContactPhone || '');
      setMedicalNotes(existingMember.medicalNotes || '');
      const regularPlan = plans.find((plan) => plan.id === 'plan_monthly');
      if (regularPlan) {
        setSelectedPlanId(regularPlan.id);
        setAdmissionFee(0);
        setRegularFee(regularPlan.price);
        setPaidAmount(regularPlan.price);
        setBillingMonths(1);
      }
      setDuplicateWarning(`${existingMember.fullName} (${existingMember.rollNumber}) has an archived profile. Rejoining will restore this profile and retain its history.`);
      return;
    }

    if (returningMember) {
      setRollNumber(db.generateNextRollNumber());
      setSelectedPlanId(defaultPlan?.id || '');
      setAdmissionFee(2000);
      setRegularFee(2000);
      setBillingMonths(1);
      setPaidAmount(4000);
    }
    setReturningMember(null);
    if (val.length >= 10) {
      const dup = db.isDuplicateMember(val);
      setDuplicateWarning(dup.duplicate ? dup.reason || 'Duplicate phone number found' : null);
    } else {
      setDuplicateWarning(null);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      alert('Camera access unavailable. Please use file upload instead.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 240, 240);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
      }
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRollNumber(db.generateNextRollNumber());
      setReturningMember(null);
      setDuplicateWarning(null);
      setFormError(null);
      setFullName('');
      setMobileNumber('');
      setWhatsappNumber('');
      setSelectedPlanId(defaultPlan?.id || '');
      setAdmissionFee(2000);
      setRegularFee(2000);
      setBillingMonths(1);
      setPaidAmount(4000);
      setCustomPlanName('Custom Membership');
      setPaymentMethod('Cash');
      setStartDate(new Date().toISOString().split('T')[0]);
      setShowOptionalFields(false);
      setFatherName('');
      setGender('Male');
      setBloodGroup('');
      setCnic('');
      setDateOfBirth('');
      setAddress('');
      setEmergencyName('');
      setEmergencyPhone('');
      setMedicalNotes('');
      setPhotoUrl('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Please enter member full name');
      return;
    }
    if (!mobileNumber.trim()) {
      setFormError('Please enter mobile contact number');
      return;
    }
    if (!db.isValidPhoneNumber(mobileNumber)) {
      setFormError('Please enter an 11-digit phone number, or 12 digits including Pakistan country code 92');
      return;
    }
    if (emergencyPhone.trim() && !db.isValidPhoneNumber(emergencyPhone)) {
      setFormError('Emergency phone must contain 11 digits, or 12 digits including Pakistan country code 92');
      return;
    }
    if (!bloodGroup) {
      setFormError('Please select a blood group');
      return;
    }
    if (![admissionFee, regularFee, paidAmount].every(Number.isFinite)
      || admissionFee < 0 || regularFee < 0 || paidAmount < 0 || paidAmount > calculatedTotalFee) {
      setFormError('Fees must be valid non-negative amounts, and payment cannot exceed the total fee');
      return;
    }

    const existingMember = db.getMemberByPhone(mobileNumber);
    const returningProfile = existingMember?.archived ? existingMember : null;
    const dup = db.isDuplicateMember(mobileNumber, undefined, returningProfile?.id);
    if (dup.duplicate) {
      setFormError(`Cannot register: ${dup.reason}`);
      return;
    }

    const memberData = {
      fullName: fullName.trim(),
      fatherName: fatherName.trim() || undefined,
      mobileNumber: mobileNumber.trim(),
      whatsappNumber: whatsappNumber.trim() || mobileNumber.trim(),
      email: undefined,
      gender,
      bloodGroup,
      dateOfBirth: dateOfBirth || undefined,
      address: address.trim() || undefined,
      registrationDate: new Date().toISOString().split('T')[0],
      planId: isCustomPlan ? `custom_${Date.now()}` : selectedPlan.id,
      planName: isCustomPlan ? customPlanName.trim() || 'Custom Membership' : selectedPlan.name,
      startDate,
      expiryDate,
      emergencyContactName: emergencyName.trim() || 'Not Provided',
      emergencyContactPhone: emergencyPhone.trim() || mobileNumber.trim(),
      medicalNotes: medicalNotes.trim() || undefined,
      cnic: cnic.trim() || undefined,
      admissionFee: Number(admissionFee) || 0,
      monthlyFee: Number(regularFee) || 0,
      billingMonths: isCustomPlan ? billingMonths : 1,
      totalFee: calculatedTotalFee,
      paidAmount: Number(paidAmount) || 0,
      photoUrl: photoUrl || undefined,
    };

    let savedMember: Member;
    try {
      if (returningProfile) {
        savedMember = db.rejoinMember(returningProfile.id, memberData);
      } else {
        if (!rollNumber.trim()) {
          setFormError('Please enter a member roll number');
          return;
        }
        savedMember = db.addMember(memberData, rollNumber.trim());
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save member registration');
      return;
    }

    const initialPayment = db.getPayments().find(
      (payment) => payment.memberId === savedMember.id && payment.amount === memberData.paidAmount
    );
    onMemberCreated(initialPayment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px] transition-all">
      {/* 480px Right-side Slide-over Drawer */}
      <div className="w-[480px] max-w-full bg-[#1C1F23] border-l border-[#262A30] h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#262A30] flex items-center justify-between bg-[#15171A]">
          <div>
            <h2 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6] flex items-center gap-2">
              <span>{returningMember ? 'Rejoin Existing Member' : 'Enroll New Member'}</span>
              <span className="font-mono text-xs text-[#D9383A] bg-[#0D0E10] px-2 py-0.5 rounded-[4px] border border-[#262A30]">
                {rollNumber}
              </span>
            </h2>
            <p className="text-[11px] text-[#8B909A] mt-0.5">
              {returningMember ? 'Existing roll number and full history retained' : 'Unique member roll number and editable fee breakdown'}
            </p>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Drawer Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {formError && (
            <div role="alert" className="p-2.5 rounded-[6px] bg-[#15171A] border-l-4 border-l-[#E5484D] border-[#262A30] text-[#E5484D] flex items-center gap-2 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-2.5 rounded-[6px] bg-[#15171A] border-l-4 border-l-[#E5AE4A] border-[#262A30] text-[#E5AE4A] flex items-center gap-2 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Section 1: Package Selection Cards */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1.5">
              Membership Plan Package *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlan(p)}
                    className={`p-2.5 rounded-[6px] border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#15171A] border-[#D9383A] text-[#ECEAE6]'
                        : 'bg-[#15171A] border-[#262A30] text-[#8B909A] hover:text-[#ECEAE6]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[#ECEAE6] truncate">{p.name}</span>
                    </div>
                    <div className="font-condensed text-base font-bold text-[#D9383A] tabular-nums mt-0.5">
                      Rs. {p.price.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-[#8B909A] block mt-0.5">
                      {p.id.startsWith('plan_admission') ? 'Admission + first month' : 'Per month'} · Till {calculateExpiry(startDate, p)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSelectCustomPlan}
                className={`p-2.5 rounded-[6px] border text-left transition-all cursor-pointer ${
                  isCustomPlan
                    ? 'bg-[#15171A] border-[#D9383A] text-[#ECEAE6]'
                    : 'bg-[#15171A] border-[#262A30] text-[#8B909A] hover:text-[#ECEAE6]'
                }`}
              >
                <span className="font-semibold text-xs text-[#ECEAE6]">Custom Plan</span>
                <span className="text-[10px] text-[#8B909A] block mt-1">Set fee and number of months</span>
              </button>
            </div>
          </div>

          {/* Section 2: Member Core Information */}
          <div className="p-3.5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block">
              Member Identification
            </span>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="member-roll-number" className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block">
                  Member Unique ID / Roll # *
                </label>
                <span className="text-[10px] text-[#D9383A] font-mono font-bold">
                  Auto-formatted: the-gym-town-01
                </span>
              </div>
              <input
                type="text"
                id="member-roll-number"
                name="rollNumber"
                autoComplete="off"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="the-gym-town-01"
                readOnly={Boolean(returningMember)}
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="member-full-name" className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                Full Name *
              </label>
              <input
                id="member-full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ali Raza"
                className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="member-mobile-number" className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Mobile (WhatsApp) *
                </label>
                <input
                  id="member-mobile-number"
                  type="tel"
                  required
                  maxLength={16}
                  value={mobileNumber}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  placeholder="0300 1234567"
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
                <span className="mt-1 block text-[10px] text-[#8B909A]">Enter 11 digits (or 12 digits with country code 92).</span>
              </div>

              <div>
                <label htmlFor="member-blood-group" className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Blood Group *
                </label>
                <select
                  id="member-blood-group"
                  name="bloodGroup"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup | '')}
                  required
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                >
                  <option value="" disabled>Select blood group</option>
                  {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const).map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-1.5 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  readOnly
                  className="w-full bg-[#0D0E10] border border-[#262A30] rounded-[6px] px-3 py-1.5 text-xs font-mono font-bold text-[#D9383A]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: ADVANCED FEE MANAGEMENT (Separate Admission & Monthly Fee Inputs) */}
          <div className="p-3.5 rounded-[8px] bg-[#15171A] border border-[#262A30] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold">
                Fee Breakdown & Customization
              </span>
              <span className="font-condensed text-sm font-bold text-[#ECEAE6] tabular-nums">
                Total: Rs. {calculatedTotalFee.toLocaleString()}
              </span>
            </div>

            {isCustomPlan && (
              <div className="grid grid-cols-2 gap-2.5">
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium">
                  Custom Plan Name
                  <input
                    type="text"
                    required
                    value={customPlanName}
                    onChange={(event) => setCustomPlanName(event.target.value)}
                    className="mt-1 w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium">
                  Months
                  <input
                    type="number"
                    min="1"
                    max="36"
                    required
                    value={billingMonths}
                    onChange={(event) => {
                      const months = Math.max(1, Math.min(36, Number(event.target.value) || 1));
                      setBillingMonths(months);
                      setPaidAmount((Number(admissionFee) || 0) + (Number(regularFee) || 0) * months);
                    }}
                    className="mt-1 w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6]"
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {/* Separate New Admission Fee Input */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Admission Fee (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={admissionFee}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setAdmissionFee(val);
                    setPaidAmount(val + (Number(regularFee) || 0) * (isCustomPlan ? billingMonths : 1));
                  }}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
                <span className="text-[10px] text-[#8B909A] mt-0.5 block">One-time / advance</span>
              </div>

              {/* Separate Regular Membership Fee Input */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Monthly Fee (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={regularFee}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setRegularFee(val);
                    setPaidAmount((Number(admissionFee) || 0) + val * (isCustomPlan ? billingMonths : 1));
                  }}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
                <span className="text-[10px] text-[#8B909A] mt-0.5 block">
                  {isCustomPlan ? `Monthly fee × ${billingMonths} months` : 'Billed each calendar month'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <label htmlFor="member-paid-amount" className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Amount Received *
                </label>
                <input
                  id="member-paid-amount"
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
                <div className="text-[10px] mt-0.5 font-mono">
                  Balance:{' '}
                  <strong className={calculatedTotalFee - paidAmount > 0 ? 'text-[#E5484D]' : 'text-[#3DB88B]'}>
                    Rs. {Math.max(0, calculatedTotalFee - paidAmount).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-medium block mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                >
                  <option value="Cash">Cash (Front Desk)</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>
            </div>
          </div>

          {/* Optional Extended Fields Accordion */}
          <div className="border border-[#262A30] rounded-[6px] overflow-hidden bg-[#15171A]">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-[#8B909A] hover:text-[#ECEAE6] transition-colors cursor-pointer"
            >
              <span>Additional Details (CNIC, Address, Photo, Emergency Contact)</span>
              <span className="font-mono text-xs">{showOptionalFields ? '−' : '+'}</span>
            </button>

            {showOptionalFields && (
              <div className="p-3.5 border-t border-[#262A30] space-y-3 text-xs bg-[#1C1F23]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-[#8B909A] block mb-1">Father's Name</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Father name"
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs text-[#ECEAE6]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#8B909A] block mb-1">CNIC #</label>
                    <input
                      type="text"
                      value={cnic}
                      onChange={(e) => setCnic(e.target.value)}
                      placeholder="41303-xxxxxxx-x"
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs font-mono text-[#ECEAE6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-[#8B909A] block mb-1">Address / Area</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Saddar, Latifabad Unit 6, Hyderabad"
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs text-[#ECEAE6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-[#8B909A] block mb-1">Emergency Name</label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Relative name"
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs text-[#ECEAE6]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-[#8B909A] block mb-1">Emergency Phone</label>
                    <input
                      type="tel"
                      maxLength={16}
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="Emergency contact"
                      className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs font-mono text-[#ECEAE6]"
                    />
                  </div>
                </div>

                {/* Photo upload / camera */}
                <div>
                  <label className="text-[10px] uppercase text-[#8B909A] block mb-1">Member Photo</label>
                  <div className="flex items-center gap-2">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-10 h-10 rounded-[4px] object-cover border border-[#262A30]" />
                    ) : (
                      <div className="w-10 h-10 rounded-[4px] bg-[#15171A] border border-[#262A30] flex items-center justify-center text-[#8B909A]">
                        <User className="w-5 h-5 stroke-[1.5]" />
                      </div>
                    )}
                    <label className="px-2.5 py-1 rounded-[4px] bg-[#15171A] border border-[#262A30] text-[11px] text-[#ECEAE6] cursor-pointer hover:bg-[#262A30]">
                      <Upload className="w-3 h-3 inline mr-1" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Drawer Footer */}
          <div className="pt-4 border-t border-[#262A30] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-3.5 py-2 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] text-xs font-semibold text-[#ECEAE6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold uppercase tracking-wider text-[#ECEAE6] cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
            >
              Register & Enroll Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
