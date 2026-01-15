import { Member, AttendanceRecord, MemberType, MemberStatus } from './types';

// SECURITY NOTE: Add your JSONBin.io keys here to enable hardcoded cloud sync.
// If these are set, the app will prioritize them over local storage configurations.
export const DEFAULT_CLOUD_CONFIG = {
    apiKey: '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa', // e.g. '$2a$10$...' (X-Master-Key)
    binId: '6968447b43b1c97be9314e21'   // e.g. '678...' (Bin ID)
};

export const getSundaysInYear = (year: number) => {
  const date = new Date(year, 0, 1);
  const sundays: Date[] = [];

  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  while (date.getFullYear() === year) {
    sundays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }

  return sundays;
};

export const INITIAL_MEMBERS: Member[] = [
  // --- SUPER ADMIN (Hidden from attendance usually, or just a teacher with super powers) ---
  {
    "id": "super-admin",
    "name": "Main Admin",
    "type": MemberType.TEACHER,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "UJ",
    "role": "ADMIN",
    "passcode": "2026", // Default Pin
    "isAccessActive": true
  },
  // --- UJ CHURCH ---
  {
    "id": "init-0",
    "name": "Maxeen Portuphy",
    "type": MemberType.TEACHER,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "UJ",
    "role": "TEACHER",
    "passcode": "1234",
    "isAccessActive": true
  },
  {
    "id": "init-1",
    "name": "Emmanuel Gyan",
    "type": MemberType.TEACHER,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "UJ"
  },
  {
    "id": "init-2",
    "name": "Beatrice Yeboah Adomako",
    "type": MemberType.MEMBER,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.ACTIVE,
    "birthDate": "2014-05-09",
    "assignedChurch": "UJ"
  },
  {
    "id": "init-3",
    "name": "Brilliant Tieku",
    "type": MemberType.INCONSISTENT,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.NOT_ACTIVE,
    "birthDate": "",
    "assignedChurch": "UJ"
  },
  {
    "id": "init-4",
    "name": "Derrick Zong",
    "type": MemberType.MEMBER,
    "joinedDate": "2025-01-01",
    "status": MemberStatus.ACTIVE,
    "birthDate": "2015-10-23",
    "assignedChurch": "UJ"
  },
  // --- I CHURCH ---
  {
    "id": "i-1",
    "name": "Sarah Smith",
    "type": MemberType.TEACHER,
    "joinedDate": "2026-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "I",
    "role": "TEACHER",
    "passcode": "1111",
    "isAccessActive": true
  },
  {
    "id": "i-2",
    "name": "John Doe",
    "type": MemberType.MEMBER,
    "joinedDate": "2026-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "I",
    "birthDate": "2015-01-01"
  },
  // --- K CHURCH ---
  {
    "id": "k-1",
    "name": "Kwame Nkrumah",
    "type": MemberType.TEACHER,
    "joinedDate": "2026-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "K"
  },
  {
    "id": "k-2",
    "name": "Abena Osei",
    "type": MemberType.MEMBER,
    "joinedDate": "2026-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "K"
  },
  // --- LJ CHURCH ---
  {
    "id": "lj-1",
    "name": "Lisa Johnson",
    "type": MemberType.TEACHER,
    "joinedDate": "2026-01-01",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "LJ"
  },
  
  // REST OF UJ MEMBERS (Truncated for brevity, but logically here)
  {
    "id": "1abbcecc-7fc0-4d7c-99bd-c34c6261986f",
    "name": "Stacy Sarpong",
    "type": MemberType.FNF,
    "joinedDate": "2026-01-12T16:28:14.162Z",
    "status": MemberStatus.ACTIVE,
    "assignedChurch": "UJ"
  }
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    "date": "2026-01-04",
    "churchId": "UJ",
    "presentMemberIds": [
      "init-0",
      "init-1",
      "init-2"
    ]
  }
];