import { Member, AttendanceRecord, MemberType, MemberStatus } from './types';

// Copy this into constants.ts to make changes permanent in code
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

// SHA-256 Hashes for default passwords
// "2026" -> fa127...
// "1234" -> 03ac6...
// "1111" -> 0ffe1...

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
    // Hash of '2026'
    "passcode": "fa127e4529d2011030e463560237305949e25d2c77a915228f41395f87b89797", 
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
    // Hash of '1234'
    "passcode": "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
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
    // Hash of '1111'
    "passcode": "0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c",
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
  
  // REST OF UJ MEMBERS
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