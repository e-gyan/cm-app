const fs = require('fs');

// Fix types.ts
let types = fs.readFileSync('types.ts', 'utf8');
types = types.replace('export type NotificationType = "TRANSFER_REQUEST" | "BIRTHDAY" | "GENERAL";', 'export type NotificationType = "TRANSFER_REQUEST" | "BIRTHDAY" | "GENERAL" | "STATUS_CHANGE" | "PROMOTION" | "GENERAL_INFO";');
types = types.replace('export interface Notification {', 'export interface Notification {\n  branchId?: string;');
types = types.replace('export interface OutreachSession {', 'export interface OutreachSession {\n  date?: string;\n  status?: string;\n  sessionType?: string;\n  outcome?: string;\n  assignedMemberIds?: string[];\n  visitedMemberIds?: string[];');
types = types.replace('export interface PrayerSlot {', 'export interface PrayerSlot {\n  date?: string;\n  isCompleted?: boolean;\n  assignedMemberIds?: string[];\n  durationMins?: number;');
types = types.replace('export interface AttendanceRecord {', 'export interface AttendanceRecord {\n  punctualMemberIds?: string[];');
fs.writeFileSync('types.ts', types);

// Fix ReportExport.tsx missing AnnualViewTab
const reportFile = './components/ReportExport.tsx';
let reportContent = fs.readFileSync(reportFile, 'utf8');
if (!reportContent.includes('function AnnualViewTab')) {
    const annualViewComponent = fs.readFileSync('annual_view.ts', 'utf8');
    const exportIndex = reportContent.indexOf("export default function ReportExport");
    if (exportIndex !== -1) {
        reportContent = reportContent.slice(0, exportIndex) + annualViewComponent + '\n' + reportContent.slice(exportIndex);
        fs.writeFileSync(reportFile, reportContent);
    }
}

