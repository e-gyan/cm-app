import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  AppData,
  MemberType,
  Church,
  Member,
  MemberStatus,
  ServiceType,
} from "../types";
import {
  Copy,
  FileText,
  CheckCircle,
  Database,
  Download,
  Upload,
  AlertCircle,
  RefreshCw,
  Cloud,
  Lock,
  Code,
  MessageCircle,
  BookOpen,
  Compass,
  GitBranch,
  ArrowRight,
  ChevronDown,
  Calendar,
  Target,
  TrendingUp,
  Save,
  Briefcase,
  Sparkles,
  Edit3,
  Users,
  Share2,
  Phone,
  MapPin,
} from "lucide-react";
import { getSundaysInYear } from "../constants";
import {
  importData,
  syncFromCloud,
  updateTargets,
} from "../services/storageService";
import {
  calculateChurchDivisions,
  formatDivisionReportText,
  formatDivisionCSV,
  CHURCH_NAMES,
} from "../lib/teacherDivision";

interface ReportExportProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const ReportExport: React.FC<ReportExportProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedDivisionText, setCopiedDivisionText] = useState(false);
  const [copiedTeacherId, setCopiedTeacherId] = useState<string | null>(null);
  const [selectedDivisionChurch, setSelectedDivisionChurch] = useState<string>("ALL");
  const [includeDivisionsInReport, setIncludeDivisionsInReport] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "WHATSAPP" | "KPI" | "DIVISION" | "DATA" | "EXECUTIVE"
  >(() => {
    return (
      (sessionStorage.getItem("reports_activeTab") as
        "WHATSAPP" | "KPI" | "DIVISION" | "DATA" | "EXECUTIVE") || "WHATSAPP"
    );
  });

  useEffect(() => {
    sessionStorage.setItem("reports_activeTab", activeTab);
  }, [activeTab]);
  const [importMsg, setImportMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Executive Report State
  const [execTimeframe, setExecTimeframe] = useState<"1M" | "3M" | "1Y">(
    () =>
      (sessionStorage.getItem("reports_execTimeframe") as "1M" | "3M" | "1Y") ||
      "1M",
  );

  useEffect(() => {
    sessionStorage.setItem("reports_execTimeframe", execTimeframe);
  }, [execTimeframe]);
  const [execReportContent, setExecReportContent] = useState("");
  const [isGeneratingExec, setIsGeneratingExec] = useState(false);

  // KPI/Target Edit State
  const [editTargets, setEditTargets] = useState<Record<string, number>>(
    data.targets || {},
  );

  // Get active churches from settings
  const availableChurches = data.settings.churches;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();
  const sundaysCurrentYear = getSundaysInYear(currentYear);
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );

  // Get all unique dates from attendance records + Sundays
  const availableDates = useMemo(() => {
    const recordedDates = data.attendance.map((r) => r.date);
    const sundayDates = sundaysCurrentYear.map(
      (d) => d.toISOString().split("T")[0],
    );
    const allDates = Array.from(new Set([...recordedDates, ...sundayDates]));
    return allDates.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [data.attendance, sundaysCurrentYear]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      if (availableDates.includes(today)) {
        setSelectedDate(today);
      } else {
        // Find closest past date or just first available
        const pastDates = availableDates.filter((d) => d <= today);
        setSelectedDate(
          pastDates.length > 0 ? pastDates[0] : availableDates[0],
        );
      }
    }
  }, [availableDates, selectedDate]);

  // Update edit targets when data changes
  useEffect(() => {
    if (data.targets) {
      setEditTargets(data.targets);
    }
  }, [data.targets]);

  // --- KPI Calculation Logic ---
  const kpiStats = useMemo(() => {
    if (!isAdmin) return [];

    // Dynamic order based on settings
    return availableChurches.map((church) => {
      // Calculate Avg Attendance (Last 5 weeks)
      const attendance = data.attendance.filter((r) => r.churchId === church);
      const sortedAttendance = [...attendance].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const last5 = sortedAttendance.slice(-5);

      // Avg Weekly
      let totalAtt = 0;
      last5.forEach((r) => {
        const kids = r.presentMemberIds.filter((id) => {
          const m = data.members.find((mem) => mem.id === id);
          return m && !["Teacher", "Helper", "Volunteer"].includes(m.type);
        }).length;
        totalAtt += kids;
      });
      const avg = last5.length ? Math.round(totalAtt / last5.length) : 0;

      // Current Population (Active + FNF)
      const population = data.members.filter(
        (m) =>
          m.assignedChurch === church &&
          [MemberStatus.ACTIVE, MemberStatus.INCONSISTENT, MemberStatus.NOT_ACTIVE].includes(m.status) &&
          (m.type === MemberType.MEMBER || m.type === MemberType.FNF),
      ).length;

      return {
        church,
        avg,
        population,
        target: editTargets[church] || 0,
      };
    });
  }, [data, editTargets, isAdmin, availableChurches]);

  const handleSaveTargets = () => {
    updateTargets(editTargets);
    setImportMsg({ type: "success", text: "Targets updated successfully!" });
    setTimeout(() => setImportMsg(null), 3000);
    onUpdate();
  };

  // --- Executive Report Logic ---
  const generateExecutiveReport = async () => {
    if (!process.env.GEMINI_API_KEY) {
      setExecReportContent("Error: AI API Key not configured.");
      return;
    }

    setIsGeneratingExec(true);
    setExecReportContent("");

    try {
      const now = new Date();
      let startDate = new Date();

      if (execTimeframe === "1M") startDate.setMonth(now.getMonth() - 1);
      if (execTimeframe === "3M") startDate.setMonth(now.getMonth() - 3);
      if (execTimeframe === "1Y") startDate.setFullYear(now.getFullYear() - 1);

      // 1. Gather Data
      const relevantAttendance = data.attendance.filter(
        (r) =>
          new Date(r.date) >= startDate &&
          (activeChurch === "CM" || r.churchId === activeChurch),
      );
      const relevantOutreach = (data.outreachSessions || []).filter(
        (s) => new Date(s.date) >= startDate,
      );

      // Calculate Stats
      const totalAttendance = relevantAttendance.reduce(
        (acc, r) => acc + r.presentMemberIds.length,
        0,
      );
      const avgAttendance = relevantAttendance.length
        ? Math.round(totalAttendance / relevantAttendance.length)
        : 0;

      const newMembers = data.members.filter(
        (m) =>
          new Date(m.joinedDate) >= startDate &&
          (activeChurch === "CM" || m.assignedChurch === activeChurch),
      ).length;
      const activeMembers = data.members.filter(
        (m) =>
          [MemberStatus.ACTIVE, MemberStatus.INCONSISTENT, MemberStatus.NOT_ACTIVE].includes(m.status) &&
          (activeChurch === "CM" || m.assignedChurch === activeChurch),
      ).length;

      // Outreach Stats
      const totalVisits = relevantOutreach.reduce(
        (acc, s) => acc + (s.visitedMemberIds?.length || 0),
        0,
      );
      const completedSessions = relevantOutreach.filter(
        (s) => s.status === "COMPLETED",
      ).length;

      // Prepare Prompt
      const prompt = `
            Act as a high-level executive consultant for a church organization. 
            Write a clear, simple, and professional executive summary report for the period of the last ${execTimeframe === "1M" ? "Month" : execTimeframe === "3M" ? "Quarter" : "Year"}.
            
            Context:
            - Branch: ${activeChurch === "CM" ? "All Branches (Combined Ministry)" : activeChurch + " Branch"}
            - Total Attendance Volume: ${totalAttendance}
            - Average Weekly Attendance: ${avgAttendance}
            - New Members Joined: ${newMembers}
            - Currently Active Members: ${activeMembers}
            - Outreach Sessions Completed: ${completedSessions}
            - Total Outreach Visits Made: ${totalVisits}

            Structure the report with these sections:
            1. **Executive Summary**: A brief 2-3 sentence overview of the health of the branch/ministry.
            2. **Attendance & Engagement**: Analysis of the attendance numbers. Are we growing?
            3. **People & Retention**: Insights on new members and active base.
            4. **Outreach Impact**: Evaluation of the outreach efforts (prayers, visits).
            5. **Strategic Recommendations**: 2-3 actionable bullet points for the next period.

            Tone: Professional, encouraging, data-driven, yet simple to understand. Avoid jargon.
          `;

      const res = await fetch("/api/generate-executive-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = errorData.error || `HTTP error ${res.status}`;
        if (typeof errorMsg === "object") errorMsg = JSON.stringify(errorMsg);
        throw new Error(errorMsg);
      }

      const responseData = await res.json();
      setExecReportContent(responseData.text || "Failed to generate report.");
    } catch (e: any) {
      console.error("AI Report Gen Error", e);
      let cleanMsg = e.message || "Error generating report. Please try again.";
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error && parsed.error.message) {
          cleanMsg = parsed.error.message;
        }
      } catch (err) {}
      setExecReportContent(`Could not generate report: ${cleanMsg}`);
    } finally {
      setIsGeneratingExec(false);
    }
  };

  const handleCopyExecReport = () => {
    navigator.clipboard.writeText(execReportContent);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const renderExecutiveView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Briefcase size={20} /> Executive Summary
            </h3>
            <p className="text-slate-500 text-xs">
              AI-powered insights for leadership.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(["1M", "3M", "1Y"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setExecTimeframe(t)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${execTimeframe === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t === "1M" ? "Month" : t === "3M" ? "Quarter" : "Year"}
              </button>
            ))}
          </div>
        </div>

        {!execReportContent && !isGeneratingExec ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Sparkles className="mx-auto text-indigo-300 mb-3" size={40} />
            <h4 className="font-bold text-slate-700 mb-1">Ready to Generate</h4>
            <p className="text-xs text-slate-400 mb-4">
              Create a high-level report for the last{" "}
              {execTimeframe === "1M"
                ? "month"
                : execTimeframe === "3M"
                  ? "quarter"
                  : "year"}
              .
            </p>
            <button
              onClick={generateExecutiveReport}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Generate Report
            </button>
          </div>
        ) : (
          <div className="relative">
            {isGeneratingExec && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                <RefreshCw
                  size={32}
                  className="text-indigo-600 animate-spin mb-2"
                />
                <span className="text-xs font-bold text-indigo-600">
                  Analyzing Data...
                </span>
              </div>
            )}

            <div className="relative">
              <textarea
                value={execReportContent}
                onChange={(e) => setExecReportContent(e.target.value)}
                className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-sans text-sm text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="Report will appear here..."
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={generateExecutiveReport}
                  className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm border border-slate-100"
                  title="Regenerate"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCopyExecReport}
                className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${copiedReport ? "bg-green-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
              >
                {copiedReport ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copiedReport ? "Copied" : "Copy Report"}
              </button>
              <button
                onClick={() => {
                  const url = `mailto:?subject=Executive Report - ${activeChurch}&body=${encodeURIComponent(execReportContent)}`;
                  window.open(url);
                }}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowRight size={18} /> Share via Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- WhatsApp Report Logic ---
  const generateReport = () => {
    if (!selectedDate) return "Please select a date to generate a report.";

    const formattedDate = new Date(selectedDate).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // --- Helper to render list with Joy/Enlargement/Special split ---
    const renderListWithServices = (
      list: Member[],
      title: string,
      record: any,
    ) => {
      if (list.length === 0) return "";

      const getService = (id: string) => record?.serviceMap?.[id] || "JOY";

      const joyAttendees = list.filter((m) => getService(m.id) === "JOY");
      const enlargementAttendees = list.filter(
        (m) => getService(m.id) === "ENLARGEMENT",
      );
      const specialAttendees = list.filter(
        (m) => getService(m.id) === "SPECIAL",
      );

      let section = `*${title} (${list.length})*\n`;

      if (joyAttendees.length > 0) {
        section += `_Joy Service:_\n`;
        joyAttendees.forEach((m, i) => (section += `${i + 1}. ${m.name}\n`));
      }

      if (enlargementAttendees.length > 0) {
        if (joyAttendees.length > 0) section += `\n`; // Spacer
        section += `_Enlargement Service:_\n`;
        enlargementAttendees.forEach(
          (m, i) => (section += `${i + 1}. ${m.name}\n`),
        );
      }

      if (specialAttendees.length > 0) {
        if (joyAttendees.length > 0 || enlargementAttendees.length > 0)
          section += `\n`; // Spacer
        specialAttendees.forEach(
          (m, i) => (section += `${i + 1}. ${m.name}\n`),
        );
      }

      return section + `\n`;
    };

    // --- ADMIN GLOBAL REPORT (Figures + Names) ---
    if (activeChurch === "CM") {
      // Check for special event name across records
      const eventName = data.attendance.find(
        (r) => r.date === selectedDate && r.eventName,
      )?.eventName;
      
      let allowedBranches: { id?: string; name: string; churches: string[] }[] = [];
      let zoneName = "";

      if (currentUser.role === "ZONAL_HEAD") {
        let zone = data.settings.organization?.zones?.find(
          (z) => z.id === currentUser.zoneId || z.name.toLowerCase() === (currentUser.zoneId || "").toLowerCase()
        );
        if (!zone && data.settings.organization?.zones?.length) {
          zone = data.settings.organization.zones[0];
        }
        if (zone) {
          zoneName = zone.name;
          if (zone.branches && zone.branches.length > 0) {
            allowedBranches = zone.branches.map((b) => ({
              id: b.id,
              name: b.name,
              churches: b.churches && b.churches.length > 0 ? b.churches : availableChurches,
            }));
          } else {
            allowedBranches = [{ id: zone.id, name: zone.name, churches: availableChurches }];
          }
        } else {
          allowedBranches = [{ name: "Main", churches: availableChurches }];
        }
      } else if (currentUser.role === "BRANCH_COORDINATOR" && currentUser.branchId) {
        const branch = data.settings.organization?.zones?.flatMap(z => z.branches || [])?.find(
          (b) => b.id === currentUser.branchId || b.name === currentUser.branchId
        );
        if (branch) {
          allowedBranches = [{
            id: branch.id,
            name: branch.name,
            churches: branch.churches && branch.churches.length > 0 ? branch.churches : availableChurches,
          }];
        }
      } else {
        // ADMIN / SUPER_ADMIN or others
        const allBranches = data.settings.organization?.zones?.flatMap(z => z.branches || []) || [];
        if (allBranches.length > 0) {
          allowedBranches = allBranches.map(b => ({
            id: b.id,
            name: b.name,
            churches: b.churches && b.churches.length > 0 ? b.churches : availableChurches,
          }));
        } else {
          allowedBranches = [{ name: "Main", churches: availableChurches }];
        }
      }

      let reportTitle = "CM ATTENDANCE SUMMARY";
      if (currentUser.role === "ZONAL_HEAD") {
        reportTitle = `${(zoneName || currentUser.zoneId || "ZONE").toUpperCase()} ATTENDANCE SUMMARY`;
      } else if (currentUser.role === "BRANCH_COORDINATOR") {
        reportTitle = `${(currentUser.branchId || "BRANCH").toUpperCase()} ATTENDANCE SUMMARY`;
      }

      let report = `*${reportTitle}*\n${formattedDate}\n`;
      if (currentUser.role === "ZONAL_HEAD" && currentUser.name) {
        report += `*Zonal Head:* ${currentUser.name}\n`;
      }
      if (allowedBranches.length > 0) {
        report += `*Attached Branches (${allowedBranches.length}):* ${allowedBranches.map(b => b.name).join(", ")}\n`;
      }
      if (eventName) report += `*${eventName}*\n`;
      report += `----------------------------\n\n`;

      let grandTotal = 0;
      let grandTotalJoy = 0;
      let grandTotalEnlargement = 0;
      let grandTotalSpecial = 0;
      let grandTotalTeachers = 0;

      allowedBranches.forEach((branch) => {
        let branchHasData = false;
        let branchReport = `*BRANCH: ${branch.name.toUpperCase()}*\n`;
        
        branch.churches.forEach((church) => {
          const record = data.attendance.find(
            (r) => r.date === selectedDate && r.churchId === church && (r.branchId === branch.id || r.branchId === branch.name || (!r.branchId && allowedBranches.length === 1))
          );
          if (!record) return;

          const presentMembers = data.members.filter((m) =>
            record.presentMemberIds.includes(m.id),
          );

          const staff = presentMembers.filter(
            (m) =>
              ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
              m.type === MemberType.TEACHER,
          );
          const children = presentMembers.filter(
            (m) =>
              !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
              m.type !== MemberType.TEACHER,
          );

          const getService = (id: string) => record?.serviceMap?.[id] || "JOY";
          const joyCount = children.filter(m => getService(m.id) === "JOY").length;
          const enlargementCount = children.filter(m => getService(m.id) === "ENLARGEMENT").length;
          const specialCount = children.filter(m => getService(m.id) === "SPECIAL").length;

          const teachersCount = staff.length;
          const membersCount = children.length;
          const classTotal = membersCount + teachersCount;

          if (classTotal > 0) {
            branchHasData = true;
            branchReport += `*${church} Church*
`;
            if (joyCount > 0) branchReport += `Joy Service : ${joyCount}\n`;
            if (enlargementCount > 0) branchReport += `Enlargement Service : ${enlargementCount}\n`;
            if (specialCount > 0) branchReport += `${eventName || "Special Service"} : ${specialCount}\n`;
            if (teachersCount > 0) branchReport += `Teachers : ${teachersCount}\n`;
            branchReport += `Total : ${classTotal}\n\n`;

            grandTotal += classTotal;
            grandTotalJoy += joyCount;
            grandTotalEnlargement += enlargementCount;
            grandTotalSpecial += specialCount;
            grandTotalTeachers += teachersCount;
          }
        });
        
        if (branchHasData) {
           report += branchReport;
        }
      });

      report += `----------------------------\n`;
      report += `*OVERALL TOTALS*\n`;
      if (grandTotalJoy > 0) report += `Joy Service : ${grandTotalJoy}\n`;
      if (grandTotalEnlargement > 0) report += `Enlargement Service : ${grandTotalEnlargement}\n`;
      if (grandTotalSpecial > 0) report += `${eventName || "Special Service"} : ${grandTotalSpecial}\n`;
      if (grandTotalTeachers > 0) report += `Teachers : ${grandTotalTeachers}\n`;
      report += `*GRAND TOTAL: ${grandTotal}*\n`;

      if (grandTotal === 0) {
        report += `\n_No attendance data recorded yet for this date._`;
      } else {
        report += `\n============================\n\n`;
        report += `*DETAILED BREAKDOWN*\n\n`;

        allowedBranches.forEach((branch) => {
          let branchDetailHasData = false;
          let branchDetailReport = `*\u25A0 ${branch.name.toUpperCase()} BRANCH*\n\n`;
          
          branch.churches.forEach((church) => {
            const churchReport = renderSingleChurch(church, branch);
            if (churchReport) {
               branchDetailHasData = true;
               branchDetailReport += churchReport + `\n----------------------------\n\n`;
            }
          });
          
          if (branchDetailHasData) {
             report += branchDetailReport;
          }
        });
      }

      return report;
    }

    // --- Helper for Single Branch Report (Names included with Service Split) ---
    function renderSingleChurch(churchId: string, branchObj?: { id?: string, name: string }) {
      const record = data.attendance.find(
        (r) => r.date === selectedDate && r.churchId === churchId && (!branchObj || r.branchId === branchObj.id || r.branchId === branchObj.name || (!r.branchId))
      );
      if (!record) return "";

      const presentMembers = data.members.filter((m) => record.presentMemberIds.includes(m.id));
      presentMembers.sort((a, b) => a.name.localeCompare(b.name));

      const teachers = presentMembers.filter(
        (m) =>
          ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
          m.type === MemberType.TEACHER,
      );

      const getService = (id: string) => record?.serviceMap?.[id] || "JOY";

      const allChildren = presentMembers.filter(
        (m) =>
          !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
          m.type !== MemberType.TEACHER,
      );
      const totalCount = presentMembers.length;

      const totalJoy = allChildren.filter((m) => getService(m.id) === "JOY").length;
      const totalEnlargement = allChildren.filter((m) => getService(m.id) === "ENLARGEMENT").length;
      const totalSpecial = allChildren.filter((m) => getService(m.id) === "SPECIAL").length;

      let report = `*${churchId} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
      const globalEventName = data.attendance.find((r) => r.date === selectedDate && r.eventName)?.eventName;
      const eventNameToUse = record.eventName || globalEventName;
      if (eventNameToUse) report += `*${eventNameToUse}*\n`;
      report += `------------------\n`;
      const isTeacherRole = currentUser.role === "TEACHER" || !isAdmin;
      const totalLabel = isTeacherRole ? "TOTAL" : "TOTAL PRESENT";
      report += `*${totalLabel}: ${totalCount}*\n`;

      const splits = [];
      if (totalJoy > 0) splits.push(`Joy: ${totalJoy}`);
      if (totalEnlargement > 0) splits.push(`Enlargement: ${totalEnlargement}`);
      if (totalSpecial > 0) splits.push(`${eventNameToUse || "Special"}: ${totalSpecial}`);
      if (teachers.length > 0) splits.push(`Teachers: ${teachers.length}`);

      if (splits.length > 0) {
        report += `(${splits.join(" | ")})\n\n`;
      } else {
        report += `\n`;
      }

      const members = allChildren.filter((m) => m.type === MemberType.MEMBER);
      const fnfs = allChildren.filter((m) => m.type === MemberType.FNF);
      const visitors = allChildren.filter((m) => m.type === MemberType.VISITOR);
      const notMembers = allChildren.filter((m) => m.type === MemberType.NOT_MEMBER);

      if (members.length > 0) report += renderListWithServices(members, "MEMBERS", record);
      else report += `*MEMBERS (0)*\n_None_\n\n`;

      if (fnfs.length > 0) report += renderListWithServices(fnfs, "FNF", record);
      if (visitors.length > 0) report += renderListWithServices(visitors, "VISITORS", record);
      if (notMembers.length > 0) report += renderListWithServices(notMembers, "NOT A MEMBER", record);

      if (teachers.length > 0) {
        report += `*TEACHERS (${teachers.length})*\n`;
        teachers.forEach((m, i) => (report += `${i + 1}. ${m.name}\n`));
        report += `\n`;
      }

      if (includeDivisionsInReport) {
        const divisions = calculateChurchDivisions(data.members, ["UJ", "LJ", "K", "I"]);
        report += `\n============================\n\n` + formatDivisionReportText(divisions);
      }

      return report;
    }

    if (activeChurch !== "CM") {
      let currentBranchObj = undefined;
      if (currentUser.branchId) {
        currentBranchObj = { id: currentUser.branchId, name: currentUser.branchId };
      }
      let churchReport = renderSingleChurch(activeChurch, currentBranchObj);
      if (!churchReport) return `No attendance data recorded for ${selectedDate} in ${activeChurch} Church.`;
      
      if (includeDivisionsInReport && ["UJ", "LJ", "K", "I"].includes(activeChurch)) {
        const divisions = calculateChurchDivisions(data.members, [activeChurch]);
        churchReport += `\n============================\n\n` + formatDivisionReportText(divisions);
      }
      return churchReport;
    }

    return "";
  };

  const divisions = useMemo(() => {
    return calculateChurchDivisions(data.members, ["UJ", "LJ", "K", "I"]);
  }, [data.members]);

  const handleCopyDivisions = () => {
    const text = formatDivisionReportText(divisions);
    navigator.clipboard.writeText(text);
    setCopiedDivisionText(true);
    setTimeout(() => setCopiedDivisionText(false), 2000);
  };

  const handleCopyTeacherAssignment = (teacherName: string, members: Member[]) => {
    let text = `👤 *Teacher:* ${teacherName} (${members.length} Members)\n\n`;
    members.forEach((m, idx) => {
      const phoneStr = m.parentPhone || m.phone ? ` (📞 ${m.parentPhone || m.phone})` : "";
      text += `${idx + 1}. ${m.name}${phoneStr}\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedTeacherId(teacherName);
    setTimeout(() => setCopiedTeacherId(null), 2000);
  };

  const handleDownloadDivisionCSV = () => {
    const csvContent = formatDivisionCSV(divisions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `teacher_member_divisions_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    const text = generateReport();
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const text = generateReport();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleDownloadBackup = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `cm_backup_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") {
        const result = importData(content);
        if (result.success) {
          setImportMsg({ type: "success", text: result.message });
          onUpdate();
        } else {
          setImportMsg({ type: "error", text: result.message });
        }
        setTimeout(() => setImportMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Render Functions ---

  const renderDivisionView = () => {
    const displayedChurches =
      selectedDivisionChurch === "ALL"
        ? ["UJ", "LJ", "K", "I"]
        : [selectedDivisionChurch];

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        {/* Banner Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 bg-indigo-500/30 rounded-xl">
                  <Users size={20} className="text-indigo-200" />
                </span>
                <h3 className="text-xl font-bold">
                  Equal Teacher & Member Division
                </h3>
              </div>
              <p className="text-indigo-200 text-xs md:text-sm">
                Equal member allocation across active teachers for UJ, LJ, K, and I churches (UJ Branch Head omitted).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={handleCopyDivisions}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${copiedDivisionText ? "bg-green-500 text-white" : "bg-white text-indigo-900 hover:bg-indigo-50"}`}
              >
                {copiedDivisionText ? <CheckCircle size={15} /> : <Copy size={15} />}
                {copiedDivisionText ? "Copied All!" : "Copy WhatsApp Report"}
              </button>
              <button
                onClick={handleDownloadDivisionCSV}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-700/60 hover:bg-indigo-700 text-white border border-indigo-500/30 rounded-xl font-bold text-xs transition-all shadow-md"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Quick Church Filter Tabs */}
          <div className="flex bg-black/20 p-1 rounded-xl gap-1 overflow-x-auto">
            {["ALL", "UJ", "LJ", "K", "I"].map((c) => {
              const div = divisions[c];
              const countStr = div ? ` (${div.totalMembers}m / ${div.totalEligibleTeachers}t)` : "";
              return (
                <button
                  key={c}
                  onClick={() => setSelectedDivisionChurch(c)}
                  className={`flex-1 min-w-[70px] py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedDivisionChurch === c ? "bg-white text-indigo-950 shadow-sm" : "text-indigo-200 hover:bg-white/10"}`}
                >
                  {c === "ALL" ? "All Churches" : CHURCH_NAMES[c] || c}
                  {c !== "ALL" && countStr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Church Breakdown Sections */}
        <div className="space-y-6">
          {displayedChurches.map((churchKey) => {
            const div = divisions[churchKey];
            if (!div) return null;

            return (
              <div
                key={churchKey}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5"
              >
                {/* Church Header Card */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold flex items-center justify-center text-sm">
                        {churchKey}
                      </span>
                      <h4 className="font-extrabold text-lg text-slate-800">
                        {div.churchName}
                      </h4>
                    </div>
                    {churchKey === "UJ" && div.omittedTeachers.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                        <Sparkles size={12} />
                        Branch Head omitted from division:{" "}
                        <span className="font-bold">
                          {div.omittedTeachers.map((t) => t.name).join(", ")}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Members
                      </span>
                      <span className="text-sm font-extrabold text-slate-700">
                        {div.totalMembers}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Teachers
                      </span>
                      <span className="text-sm font-extrabold text-purple-600">
                        {div.totalEligibleTeachers}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">
                        Allocation
                      </span>
                      <span className="text-sm font-extrabold text-indigo-700">
                        ~{div.membersPerTeacherAvg} / teacher
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teachers Assignment Grid */}
                {div.assignments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {div.assignments.map((asg, idx) => {
                      const isCopied = copiedTeacherId === asg.teacher.name;

                      return (
                        <div
                          key={asg.teacher.id}
                          className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 hover:border-indigo-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Teacher Header */}
                            <div className="flex justify-between items-start mb-3 pb-2.5 border-b border-slate-200/50">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                                  {asg.teacher.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-800 text-sm">
                                    {idx + 1}. {asg.teacher.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold uppercase">
                                    {asg.teacher.role || asg.teacher.type}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-1 bg-white border border-slate-200 text-indigo-600 rounded-lg text-xs font-black shadow-2xs">
                                  {asg.count} Members
                                </span>
                                <button
                                  onClick={() =>
                                    handleCopyTeacherAssignment(
                                      asg.teacher.name,
                                      asg.members,
                                    )
                                  }
                                  title="Copy this teacher's list"
                                  className={`p-1.5 rounded-lg border transition-all ${isCopied ? "bg-green-500 text-white border-green-500" : "bg-white text-slate-500 hover:text-indigo-600 border-slate-200"}`}
                                >
                                  {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Assigned Members List */}
                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                              {asg.members.map((m, mIdx) => {
                                const phone = m.parentPhone || m.phone;
                                return (
                                  <div
                                    key={m.id}
                                    className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 text-xs hover:border-indigo-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[10px] font-bold text-slate-400 w-4 text-right">
                                        {mIdx + 1}.
                                      </span>
                                      <span className="font-bold text-slate-800 truncate">
                                        {m.name}
                                      </span>
                                      {m.gender && (
                                        <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-medium">
                                          {m.gender.charAt(0)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.status === MemberStatus.ACTIVE ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                                      >
                                        {m.status}
                                      </span>
                                      {phone ? (
                                        <a
                                          href={`tel:${phone}`}
                                          className="text-slate-400 hover:text-indigo-600 p-1"
                                          title={`Call ${phone}`}
                                        >
                                          <Phone size={12} />
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
                    <AlertCircle size={20} className="shrink-0 text-amber-600" />
                    <p>
                      No active teachers registered for {div.churchName}. All {div.totalMembers} members are currently unassigned.
                    </p>
                  </div>
                )}

                {/* Unassigned Warning if any */}
                {div.unassignedMembers.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="font-bold text-xs text-red-700 uppercase mb-2">
                      ⚠️ Unassigned Members ({div.unassignedMembers.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {div.unassignedMembers.map((m) => (
                        <span
                          key={m.id}
                          className="px-2 py-1 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-800"
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderKPIView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-lg">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Target size={24} /> Ministry Targets
        </h3>
        <p className="text-slate-300 text-sm mb-4">
          Set growth goals for each branch.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiStats.map((stat) => (
            <div
              key={stat.church}
              className="bg-white/10 rounded-xl p-4 border border-white/10"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">{stat.church}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${stat.population >= stat.target ? "bg-green-500 text-white" : "bg-white/20 text-slate-300"}`}
                >
                  {stat.target > 0
                    ? Math.round((stat.population / stat.target) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="text-2xl font-bold">
                {stat.population}{" "}
                <span className="text-sm text-slate-400 font-normal">
                  / {stat.target}
                </span>
              </div>
              <div className="w-full bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (stat.population / (stat.target || 1)) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} /> Edit Targets
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableChurches.map((c) => (
              <div key={c}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {c} Target
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  value={editTargets[c] || 0}
                  onChange={(e) =>
                    setEditTargets({
                      ...editTargets,
                      [c]: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveTargets}
            className="mt-4 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={18} /> Save New Targets
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Reports & Insights
            </h2>
            <p className="text-slate-500 font-medium">
              Generate updates and manage system data.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {[
              { id: "WHATSAPP", icon: MessageCircle, label: "Report" },
              { id: "KPI", icon: Target, label: "KPIs" },
              { id: "DIVISION", icon: Users, label: "Teacher Division" },
              { id: "EXECUTIVE", icon: Briefcase, label: "Executive" },
              { id: "DATA", icon: Database, label: "Data" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <tab.icon size={16} />{" "}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notification Area */}
        {importMsg && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${importMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}
          >
            {importMsg.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="font-bold text-sm">{importMsg.text}</span>
          </div>
        )}

        {/* TAB CONTENT */}

        {/* 1. WHATSAPP REPORT */}
        {activeTab === "WHATSAPP" && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
              <span className="font-bold flex items-center gap-1.5">
                <Users size={15} className="text-indigo-600" /> Include Teacher Member Allocation in WhatsApp export
              </span>
              <button
                onClick={() => setIncludeDivisionsInReport(!includeDivisionsInReport)}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${includeDivisionsInReport ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"}`}
              >
                {includeDivisionsInReport ? "Included (ON)" : "Excluded (OFF)"}
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap h-64 sm:h-96 overflow-y-auto shadow-inner">
              {generateReport()}
            </div>

            <div className="flex flex-col gap-3">
              <div className="w-full">
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyReport}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${copiedReport ? "bg-green-600 text-white shadow-lg shadow-green-200" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {copiedReport ? (
                    <CheckCircle size={18} />
                  ) : (
                    <Copy size={18} />
                  )}
                  <span className="text-sm">
                    {copiedReport ? "Copied!" : "Copy"}
                  </span>
                </button>
                <button
                  onClick={handleOpenWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20bd5a] shadow-lg shadow-green-100 transition-all active:scale-95"
                >
                  <MessageCircle size={18} />{" "}
                  <span className="text-sm">WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. KPI VIEW */}
        {activeTab === "KPI" && renderKPIView()}

        {/* 3. TEACHER DIVISION VIEW */}
        {activeTab === "DIVISION" && renderDivisionView()}

        {/* 4. EXECUTIVE VIEW */}
        {activeTab === "EXECUTIVE" && renderExecutiveView()}

        {/* 5. DATA MANAGEMENT */}
        {activeTab === "DATA" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                  <Download size={20} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-slate-800">Backup Data</h4>
                  <p className="text-xs text-slate-500">Download JSON file</p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="text-slate-300 group-hover:text-indigo-600"
              />
            </button>

            <div className="relative group">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                    <Upload size={20} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800">Restore Data</h4>
                    <p className="text-xs text-slate-500">Upload backup file</p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-slate-300 group-hover:text-indigo-600"
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportExport;
