import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/desktop/TitleBar';
import { CommandPalette } from './components/desktop/CommandPalette';
import { Sidebar } from './components/layout/Sidebar';
import { HeaderBar } from './components/layout/HeaderBar';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { MemberManagement } from './components/members/MemberManagement';
import { BloodDirectory } from './components/members/BloodDirectory';
import { SmartAttendance } from './components/attendance/SmartAttendance';
import { MemberFeeLedger } from './components/finance/MemberFeeLedger';
import { ApplicationSettings } from './components/settings/ApplicationSettings';
import { MembershipPlans } from './components/membership/MembershipPlans';
import { InventoryManagement } from './components/inventory/InventoryManagement';
import { NewMemberModal } from './components/members/NewMemberModal';
import { MemberProfileModal } from './components/members/MemberProfileModal';
import { MonthlyFeeRenewalModal } from './components/membership/MonthlyFeeRenewalModal';
import { PrintableReceipt } from './components/finance/PrintableReceipt';
import { db } from './db/storage';
import { WhatsAppService } from './services/whatsappService';
import { Member, PaymentRecord } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [showNewMemberModal, setShowNewMemberModal] = useState(false);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [quickPaymentMemberId, setQuickPaymentMemberId] = useState<string | undefined>();
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalRollNumber, setRenewalRollNumber] = useState<string | undefined>();
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<Member | null>(null);
  const [registrationReceipt, setRegistrationReceipt] = useState<PaymentRecord | null>(null);

  // Database state
  const [dbState, setDbState] = useState(db.getState());

  // Subscribe to database updates
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setDbState({ ...db.getState() });
    });
    return () => unsubscribe();
  }, []);

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectMember = (member: Member) => {
    setSelectedMemberForProfile(member);
    setActiveTab('members');
  };

  const expiringList = WhatsAppService.getMembersExpiringIn3Days();
  const overdueMembers = db.getMembers().filter((m) => m.balanceDue > 0);
  const unreadCount = expiringList.length + overdueMembers.length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0D0E10] text-[#ECEAE6] overflow-hidden font-sans select-none">
      {/* 1. Custom Windows Desktop Title Bar */}
      <TitleBar onOpenLicense={() => setActiveTab('settings')} />

      {/* 2. Main Desktop Workstation Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentUser={dbState.currentUser}
        />

        {/* Viewport Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0D0E10] overflow-hidden">
          {/* Top Header Bar */}
          <HeaderBar
            currentTab={activeTab}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
            unreadNotifications={unreadCount}
            onOpenNewMember={() => setShowNewMemberModal(true)}
            onOpenMonthlyRenewal={() => {
              setRenewalRollNumber(undefined);
              setShowRenewalModal(true);
            }}
            onOpenQuickPayment={() => {
              setActiveTab('ledger');
              setQuickPaymentMemberId(undefined);
              setShowQuickPayment(true);
            }}
            onNavigate={(tab) => setActiveTab(tab)}
          />

          {/* Active Screen Container with scrollable viewport */}
          <main className="flex-1 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <ExecutiveDashboard
                onNavigate={(tab) => setActiveTab(tab)}
                onSelectMember={handleSelectMember}
                onOpenNewMember={() => setShowNewMemberModal(true)}
                onOpenMonthlyRenewal={(rollNumber) => {
                  setRenewalRollNumber(rollNumber);
                  setShowRenewalModal(true);
                }}
                onOpenQuickPayment={() => {
                  setActiveTab('ledger');
                  setQuickPaymentMemberId(undefined);
                  setShowQuickPayment(true);
                }}
              />
            )}

            {activeTab === 'members' && (
              <MemberManagement
                selectedMemberFromParent={selectedMemberForProfile}
                onClearSelectedMember={() => setSelectedMemberForProfile(null)}
                onOpenMonthlyRenewal={(rollNumber) => {
                  setRenewalRollNumber(rollNumber);
                  setShowRenewalModal(true);
                }}
                onOpenQuickPaymentForMember={(m) => {
                    setSelectedMemberForProfile(null);
                    setQuickPaymentMemberId(m.id);
                    setActiveTab('ledger');
                  setShowQuickPayment(true);
                }}
              />
            )}

            {activeTab === 'blood' && <BloodDirectory />}

            {activeTab === 'inventory' && <InventoryManagement />}

            {activeTab === 'plans' && <MembershipPlans />}

            {activeTab === 'attendance' && <SmartAttendance />}

            {activeTab === 'ledger' && (
              <MemberFeeLedger
                initialOpenCollectPayment={showQuickPayment}
                initialMemberId={quickPaymentMemberId}
                onClearInitialPayment={() => {
                  setShowQuickPayment(false);
                  setQuickPaymentMemberId(undefined);
                }}
              />
            )}

            {activeTab === 'settings' && <ApplicationSettings />}
          </main>
        </div>
      </div>

      {/* 4. Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onSelectMember={handleSelectMember}
        onOpenNewMember={() => setShowNewMemberModal(true)}
        onOpenMonthlyRenewal={(rollNumber) => {
          setRenewalRollNumber(rollNumber);
          setShowRenewalModal(true);
        }}
      />

      {/* 5. Slide-Out Notification & Expiry Alert Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onSelectMember={handleSelectMember}
      />

      {/* 8. Quick New Member Enrollment Modal */}
      {showNewMemberModal && (
        <NewMemberModal
          isOpen={showNewMemberModal}
          onClose={() => setShowNewMemberModal(false)}
          onMemberCreated={(payment) => {
            setDbState({ ...db.getState() });
            if (payment) setRegistrationReceipt(payment);
          }}
        />
      )}
      {registrationReceipt && (
        <PrintableReceipt
          payment={registrationReceipt}
          onClose={() => setRegistrationReceipt(null)}
        />
      )}

      {/* 9. Monthly Fee Renewal by Unique ID Modal */}
      {showRenewalModal && (
        <MonthlyFeeRenewalModal
          isOpen={showRenewalModal}
          onClose={() => {
            setShowRenewalModal(false);
            setRenewalRollNumber(undefined);
          }}
          initialRollNumber={renewalRollNumber}
          onRenewSuccess={() => {
            setDbState({ ...db.getState() });
          }}
        />
      )}

      {/* 10. Member Profile Modal */}
      {selectedMemberForProfile && activeTab !== 'members' && (
        <MemberProfileModal
          member={selectedMemberForProfile}
          onClose={() => setSelectedMemberForProfile(null)}
          onUpdate={() => setDbState({ ...db.getState() })}
        />
      )}
    </div>
  );
}
