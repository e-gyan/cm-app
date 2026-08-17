const fs = require('fs');
const file = './components/OutreachHub.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCandidates = `    const candidates = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !currentMemberIds.includes(m.id) &&
        !recentlyVisited.has(m.id) &&
        !assignedInPending.has(m.id) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
        (neededType === "ANY" ||
          (neededType === "INCONSISTENT"
            ? m.status === MemberStatus.INCONSISTENT
            : m.type === neededType)),
    );`;

const newCandidates = `    const candidates = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !currentMemberIds.includes(m.id) &&
        !recentlyVisited.has(m.id) &&
        !assignedInPending.has(m.id) &&
        m.type === MemberType.MEMBER &&
        m.status !== MemberStatus.ARCHIVED &&
        (neededType === "ANY" ||
          (neededType === "INCONSISTENT"
            ? (m.status === MemberStatus.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE)
            : m.status === MemberStatus.ACTIVE)),
    );`;

const oldAnyCandidates = `      const anyCandidates = data.members.filter(
        (m) =>
          isMemberInActiveChurch(m) &&
          !currentMemberIds.includes(m.id) &&
          !recentlyVisited.has(m.id) &&
          !assignedInPending.has(m.id) &&
          !["Teacher", "Helper", "Volunteer"].includes(m.type),
      );`;

const newAnyCandidates = `      const anyCandidates = data.members.filter(
        (m) =>
          isMemberInActiveChurch(m) &&
          !currentMemberIds.includes(m.id) &&
          !recentlyVisited.has(m.id) &&
          !assignedInPending.has(m.id) &&
          m.type === MemberType.MEMBER &&
          m.status !== MemberStatus.ARCHIVED,
      );`;

content = content.replace(oldCandidates, newCandidates);
content = content.replace(oldAnyCandidates, newAnyCandidates);
fs.writeFileSync(file, content);
