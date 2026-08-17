const fs = require('fs');
const file = './components/OutreachHub.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `
    const activeCount = currentMembers.filter(
      (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE,
    ).length;
    const fnfCount = currentMembers.filter(
      (m) => m.type === MemberType.FNF,
    ).length;
    const inconsistentCount = currentMembers.filter(
      (m) => m.status === MemberStatus.INCONSISTENT,
    ).length;

    // 2. Determine Need
    let neededType: MemberType | "INCONSISTENT" | "ANY" = "ANY";
    if (inconsistentCount < 1) neededType = "INCONSISTENT";
    else if (fnfCount < 1) neededType = MemberType.FNF;
    else if (activeCount < 2) neededType = MemberType.MEMBER;
`;

const newLogic = `
    const activeCount = currentMembers.filter(
      (m) => m.type === MemberType.MEMBER && m.status === MemberStatus.ACTIVE,
    ).length;
    const inconsistentCount = currentMembers.filter(
      (m) => m.type === MemberType.MEMBER && (m.status === MemberStatus.INCONSISTENT || m.status === MemberStatus.NOT_ACTIVE),
    ).length;

    // 2. Determine Need
    let neededType: MemberType | "INCONSISTENT" | "ANY" = "ANY";
    if (inconsistentCount < 1) neededType = "INCONSISTENT";
    else if (activeCount < 3) neededType = MemberType.MEMBER;
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
