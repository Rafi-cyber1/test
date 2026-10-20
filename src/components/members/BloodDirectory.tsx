import React, { useState } from 'react';
import { Droplet, MessageCircle, Phone, Search } from 'lucide-react';
import { db } from '../../db/storage';
import { BloodGroup } from '../../types';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const toWhatsAppNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
};

export const BloodDirectory: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | 'ALL'>('ALL');
  const members = db.getMembers();

  const groupCounts = Object.fromEntries(BLOOD_GROUPS.map((group) => [
    group,
    members.filter((member) => member.bloodGroup === group).length,
  ])) as Record<BloodGroup, number>;

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query ||
      member.fullName.toLowerCase().includes(query) ||
      member.mobileNumber.toLowerCase().includes(query) ||
      member.rollNumber.toLowerCase().includes(query);
    return matchesQuery && (selectedGroup === 'ALL' || member.bloodGroup === selectedGroup);
  });

  const updateBloodGroup = (memberId: string, bloodGroup: string) => {
    const updated = db.updateMember(memberId, {
      bloodGroup: bloodGroup ? bloodGroup as BloodGroup : undefined,
    });
    if (!updated) {
      alert('Unable to update this member’s blood group. Please try again.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0D0E10] text-[#ECEAE6]">
      <section className="p-5 border-b border-[#262A30] bg-[#15171A]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-[6px] bg-[#B8787C]/10 text-[#C28A8D]">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Blood Group Directory</h2>
            <p className="mt-1 text-xs text-[#8B909A]">
              Active members · {members.length} listed
            </p>
          </div>
        </div>
      </section>

      <div className="p-5 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {BLOOD_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(selectedGroup === group ? 'ALL' : group)}
              aria-pressed={selectedGroup === group}
              className={`p-3 rounded-[8px] border text-left transition-colors ${
                selectedGroup === group
                  ? 'border-[#9B6266] bg-[#9B6266]/10'
                    : 'border-[#262A30] bg-[#15171A] hover:border-[#565B64]'
              }`}
            >
              <span className="block text-xs font-bold text-[#ECEAE6]">{group}</span>
              <span className="block mt-1 font-mono text-lg font-bold text-[#C28A8D] tabular-nums">
                {groupCounts[group]}
              </span>
              <span className="text-[10px] text-[#8B909A]">members</span>
            </button>
          ))}
        </div>

        <section className="rounded-[8px] border border-[#262A30] bg-[#15171A] overflow-hidden">
          <div className="p-3 border-b border-[#262A30] flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider">Member Contacts</h3>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B909A]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, phone, roll #"
                  className="w-56 max-w-full bg-[#0D0E10] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#9B6266] focus:outline-none"
                />
              </label>
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value as BloodGroup | 'ALL')}
                aria-label="Filter by blood group"
                className="bg-[#0D0E10] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
              >
                <option value="ALL">All blood groups</option>
                {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-[#1C1F23] text-[10px] uppercase tracking-wider text-[#8B909A]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Phone Number</th>
                  <th className="px-4 py-3 font-semibold">Blood Group</th>
                  <th className="px-4 py-3 font-semibold text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A30]">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[#8B909A]">
                      No members match this blood group and search.
                    </td>
                  </tr>
                ) : filteredMembers.map((member) => {
                  const phone = member.mobileNumber.trim();
                  const whatsAppPhone = toWhatsAppNumber(member.whatsappNumber || member.mobileNumber);
                  return (
                    <tr key={member.id} className="hover:bg-[#1C1F23]/50">
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-[#ECEAE6]">{member.fullName}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-[#8B909A]">{member.rollNumber}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#ECEAE6]">{member.mobileNumber}</td>
                      <td className="px-4 py-3">
                        <select
                          value={member.bloodGroup || ''}
                          onChange={(event) => updateBloodGroup(member.id, event.target.value)}
                          aria-label={`Set blood group for ${member.fullName}`}
                          className={`rounded-full border px-2 py-1 text-xs font-bold ${
                            member.bloodGroup
                              ? 'border-[#9B6266]/35 bg-[#9B6266]/10 text-[#C28A8D]'
                              : 'border-[#9B8A68]/35 bg-[#9B8A68]/10 text-[#C1B18E]'
                          }`}
                        >
                          <option value="">Not recorded</option>
                          {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {phone && (
                            <a
                              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                              aria-label={`Call ${member.fullName}`}
                              title={`Call ${member.fullName}`}
                              className="p-2 rounded-[6px] border border-[#262A30] text-[#ECEAE6] hover:border-[#3DB88B] hover:text-[#3DB88B]"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {whatsAppPhone && (
                            <a
                              href={`https://wa.me/${whatsAppPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`WhatsApp ${member.fullName}`}
                              title={`WhatsApp ${member.fullName}`}
                              className="p-2 rounded-[6px] border border-[#262A30] text-[#ECEAE6] hover:border-[#3DB88B] hover:text-[#3DB88B]"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
