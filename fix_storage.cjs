const fs = require('fs');

let content = fs.readFileSync('services/storageService.ts', 'utf8');

const regex = /export const generateOutreachSchedule = async \(m: any, d: any\) => \{ return \{ success: true, data: \[\] as string\[\], message: "" \}; \};/;

const newCode = `export const generateOutreachSchedule = async (targetMembers: any[], dates: string[]) => {
  try {
    const data = await loadData();
    const existingSessions = data.outreachSessions || [];
    
    if (targetMembers.length === 0) {
      return { success: false, message: "No members available to assign for visitation." };
    }

    const assignedMemberIds = targetMembers.map(m => m.id);
    const newSessions: any[] = [];

    for (const dateStr of dates) {
      // Check if session for this exact group already exists on this date to prevent duplicates
      // (Optional, but usually good practice. For now, just generate)
      newSessions.push({
        id: crypto.randomUUID(),
        date: dateStr,
        status: "PENDING",
        sessionType: "VISITATION",
        assignedMemberIds,
        visitedMemberIds: [],
        branchId: targetMembers[0]?.assignedChurch || "ALL"
      });
    }

    const updatedSessions = [...existingSessions, ...newSessions];
    await updateMainDoc({ outreachSessions: updatedSessions });
    return { success: true, data: updatedSessions, message: "Generated visitation schedule!" };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to generate schedule." };
  }
};`;

content = content.replace(regex, newCode);
fs.writeFileSync('services/storageService.ts', content);
console.log("storageService.ts updated");
