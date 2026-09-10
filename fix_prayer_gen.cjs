const fs = require('fs');

// 1. Update storageService.ts
let storagePath = 'services/storageService.ts';
let storageContent = fs.readFileSync(storagePath, 'utf8');

const generatePrayerCode = `export const generatePrayerSchedule = async (prayerWeek: Date, targetMembers: Member[]) => {
  try {
    const data = await loadData();
    const existingSchedule = data.prayerSchedule || [];
    
    const newSlots: PrayerSlot[] = [];
    const members = [...targetMembers];
    
    if (members.length === 0) {
      return { success: false, message: "No members available to generate schedule." };
    }

    for (let i = 0; i < 7; i++) {
      const slotDate = new Date(prayerWeek);
      slotDate.setDate(slotDate.getDate() + i);
      const dateStr = slotDate.toISOString().split('T')[0];
      const dayOfWeek = slotDate.toLocaleDateString("en-GB", { weekday: "long" });

      const assignedMemberIds = [];
      const shuffled = [...members].sort(() => 0.5 - Math.random());
      for (let j = 0; j < Math.min(5, shuffled.length); j++) {
        assignedMemberIds.push(shuffled[j].id);
      }

      newSlots.push({
        id: crypto.randomUUID(),
        date: dateStr,
        dayOfWeek: dayOfWeek,
        isCompleted: false,
        assignedMemberIds,
        durationMins: 0,
        branchId: members[0].branchId || "ALL"
      });
    }

    const updatedSchedule = [...existingSchedule, ...newSlots];
    await updateMainDoc({ prayerSchedule: updatedSchedule });

    return { success: true, data: updatedSchedule, message: "Generated weekly prayer schedule!" };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to generate schedule." };
  }
};`;

storageContent = storageContent.replace(
  'export const generatePrayerSchedule = async (m: any, d: any) => { return { success: true, data: [] as Date[], message: "" }; };',
  generatePrayerCode
);

fs.writeFileSync(storagePath, storageContent);

// 2. Update OutreachHub.tsx handleGeneratePrayer logic
let outreachPath = 'components/OutreachHub.tsx';
let outreachContent = fs.readFileSync(outreachPath, 'utf8');

const handleGenerateCode = `  const handleGeneratePrayer = async () => {
    let targetMembers = data.members.filter(
      (m) =>
        isMemberInActiveChurch(m) &&
        !["Teacher", "Helper", "Volunteer"].includes(m.type),
    );

    if (!isAdmin && activeChurch === "UJ" && (currentUser.type === MemberType.TEACHER || currentUser.role === "TEACHER" || currentUser.role === "BRANCH_COORDINATOR" || currentUser.type === MemberType.HELPER)) {
      const ujDiv = divisions["UJ"];
      if (ujDiv) {
        const assignment = ujDiv.assignments.find((a) => a.teacher.id === currentUser.id);
        if (assignment) {
          const assignedIds = new Set(assignment.members.map((m) => m.id));
          targetMembers = targetMembers.filter(m => assignedIds.has(m.id) || visitorFnfIds.has(m.id));
        }
      }
    }

    const res = await generatePrayerSchedule(prayerWeek, targetMembers);`;

outreachContent = outreachContent.replace(
  /  const handleGeneratePrayer = async \(\) => \{\n    const targetMembers = data\.members\.filter\(\n      \(m\) =>\n        isMemberInActiveChurch\(m\) &&\n        \!\["Teacher", "Helper", "Volunteer"\]\.includes\(m\.type\),\n    \);\n    const res = await generatePrayerSchedule\(prayerWeek, targetMembers\);/,
  handleGenerateCode
);

fs.writeFileSync(outreachPath, outreachContent);
