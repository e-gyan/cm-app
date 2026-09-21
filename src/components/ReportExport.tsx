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
  ChevronUp,
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
  Clock,
  DollarSign,
  Flame,
} from "lucide-react";
import { getSundaysInYear } from "../constants";
import {
  importData,


} from "../services/storageService";
import {
  calculateChurchDivisions,
  formatDivisionReportText,
  formatDivisionCSV,
  CHURCH_NAMES,
  matchesScope,
  getScopeDisplayLabel,
} from "../lib/teacherDivision";
import { hasRoleSubfeature, isSuperAdminUser } from "../lib/permissions";

interface ReportExportProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
  activeBranchId?: string;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export interface BCReportState {
  gcName: string;
  serviceStarted: string;
  serviceEnded: string;
  preacherK: string;
  messageK: string;
  preacherLJ: string;
  messageLJ: string;
  preacherUJ: string;
  messageUJ: string;
  preacherI: string;
  messageI: string;
  altarCall: number;
  cellEvangelism: number;
  outreachSouls: number;
  totalSoulsWonOverride?: number | string;
  cellMeetingsHeld: number;
  totalCellAttendance: number;
  newMembersOverride?: number | string;
  spectacularEvent: string;
  offeringOverride?: number | string;
  tithesOverride?: number | string;
  partnershipsOverride?: number | string;
  firstFruitsOverride?: number | string;
}

const ReportExport: React.FC<ReportExportProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
  activeBranchId,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedDivisionText, setCopiedDivisionText] = useState(false);
  const [copiedTeacherId, setCopiedTeacherId] = useState<string | null>(null);
  const [selectedDivisionChurch, setSelectedDivisionChurch] = useState<string>("ALL");
  const [includeDivisionsInReport, setIncludeDivisionsInReport] = useState(false);

  // Branch Coordinator Report States
  const branchObj = useMemo(() => {
    return (
      data.settings.organization?.zones
        ?.flatMap((z) => z.branches || [])
        ?.find(
          (b) =>
            b.id === activeBranchId ||
            b.name === activeBranchId ||
            b.id === currentUser.branchId ||
            b.name === currentUser.branchId
        ) || {
        id: currentUser.branchId || "branch-main",
        name: currentUser.branchId || "Branch",
      }
    );
  }, [data.settings.organization, activeBranchId, currentUser.branchId]);

  const [reportFormat, setReportFormat] = useState<"BRANCH_COORDINATOR" | "DEFAULT">("BRANCH_COORDINATOR");
  const [showBcEditor, setShowBcEditor] = useState<boolean>(true);

  const [bcReportState, setBcReportState] = useState<BCReportState>(() => ({
    gcName: "",
    serviceStarted: "9:00pm",
    serviceEnded: "12:00pm",
    preacherK: "",
    messageK: "",
    preacherLJ: "",
    messageLJ: "",
    preacherUJ: "",
    messageUJ: "",
    preacherI: "",
    messageI: "",
    altarCall: 0,
    cellEvangelism: 0,
    outreachSouls: 0,
    totalSoulsWonOverride: "",
    cellMeetingsHeld: 0,
    totalCellAttendance: 0,
    newMembersOverride: "",
    spectacularEvent: "",
    offeringOverride: "",
    tithesOverride: "",
    partnershipsOverride: "",
    firstFruitsOverride: "",
  }));

  // Synchronize / load saved values from localStorage per branch & date
  useEffect(() => {
    if (!selectedDate) return;
    const defaultGc = (branchObj.name || "THESAURUS").toUpperCase().replace(/\s*BRANCH$/i, "");
    const storageKey = `cm_bc_report_${branchObj.id || "main"}_${selectedDate}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBcReportState({
          gcName: parsed.gcName || defaultGc,
          serviceStarted: parsed.serviceStarted || "9:00pm",
          serviceEnded: parsed.serviceEnded || "12:00pm",
          preacherK: parsed.preacherK || "",
          messageK: parsed.messageK || "",
          preacherLJ: parsed.preacherLJ || "",
          messageLJ: parsed.messageLJ || "",
          preacherUJ: parsed.preacherUJ || "",
          messageUJ: parsed.messageUJ || "",
          preacherI: parsed.preacherI || "",
          messageI: parsed.messageI || "",
          altarCall: parsed.altarCall ?? 0,
          cellEvangelism: parsed.cellEvangelism ?? 0,
          outreachSouls: parsed.outreachSouls ?? 0,
          totalSoulsWonOverride: parsed.totalSoulsWonOverride ?? "",
          cellMeetingsHeld: parsed.cellMeetingsHeld ?? 0,
          totalCellAttendance: parsed.totalCellAttendance ?? 0,
          newMembersOverride: parsed.newMembersOverride ?? "",
          spectacularEvent: parsed.spectacularEvent || "",
          offeringOverride: parsed.offeringOverride ?? "",
          tithesOverride: parsed.tithesOverride ?? "",
          partnershipsOverride: parsed.partnershipsOverride ?? "",
          firstFruitsOverride: parsed.firstFruitsOverride ?? "",
        });
        return;
      } catch (e) {
        console.error("Error loading bc report storage", e);
      }
    }

    setBcReportState((prev) => ({
      ...prev,
      gcName: defaultGc,
      serviceStarted: "9:00pm",
      serviceEnded: "12:00pm",
      preacherK: "",
      messageK: "",
      preacherLJ: "",
      messageLJ: "",
      preacherUJ: "",
      messageUJ: "",
      preacherI: "",
      messageI: "",
      altarCall: 0,
      cellEvangelism: 0,
      outreachSouls: 0,
      totalSoulsWonOverride: "",
      cellMeetingsHeld: 0,
      totalCellAttendance: 0,
      newMembersOverride: "",
      spectacularEvent: "",
      offeringOverride: "",
      tithesOverride: "",
      partnershipsOverride: "",
      firstFruitsOverride: "",
    }));
  }, [selectedDate, branchObj.id, branchObj.name]);

  const updateBcReportField = (field: keyof BCReportState, val: any) => {
    setBcReportState((prev) => {
      const updated = { ...prev, [field]: val };
      if (selectedDate) {
        const storageKey = `cm_bc_report_${branchObj.id || "main"}_${selectedDate}`;
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Teachers mapped to churches for preacher selection
  const teachersByChurch = useMemo(() => {
    const isTeacher = (m: Member) =>
      ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
      m.type === MemberType.TEACHER ||
      (m.role && m.role !== "NONE");

    const getFor = (cKey: string) => {
      return data.members
        .filter(
          (m) =>
            isTeacher(m) &&
            m.assignedChurch === cKey &&
            matchesScope(m, activeBranchId || branchObj.id, data.settings?.organization)
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    return {
      K: getFor("K"),
      LJ: getFor("LJ"),
      UJ: getFor("UJ"),
      I: getFor("I"),
    };
  }, [data.members, activeBranchId, branchObj.id, data.settings?.organization]);

  // Aggregate children made members just for that Sunday
  const autoNewMembersCount = useMemo(() => {
    if (!selectedDate) return 0;
    const isTeacher = (m: Member) =>
      ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
      m.type === MemberType.TEACHER ||
      (m.role && m.role !== "NONE");

    return data.members.filter((m) => {
      if (isTeacher(m)) return false;
      if (m.type !== MemberType.MEMBER) return false;
      const joinedOn =
        m.joinedDate &&
        (m.joinedDate === selectedDate || m.joinedDate.startsWith(selectedDate));
      return (
        joinedOn &&
        matchesScope(m, activeBranchId || branchObj.id, data.settings?.organization)
      );
    }).length;
  }, [data.members, selectedDate, activeBranchId, branchObj.id, data.settings?.organization]);

  // Aggregate finances for that service/Sunday from data.transactions
  const serviceFinances = useMemo(() => {
    if (!selectedDate) {
      return { offering: 0, tithes: 0, partnerships: 0, firstFruits: 0, total: 0 };
    }
    const txns = (data.transactions || []).filter(
      (t) =>
        t.date === selectedDate &&
        t.type === "INCOME" &&
        matchesScope(t, activeBranchId || branchObj.id, data.settings?.organization)
    );

    let offering = 0;
    let tithes = 0;
    let partnerships = 0;
    let firstFruits = 0;

    txns.forEach((t) => {
      const cat = (t.category || "").toLowerCase();
      if (cat.includes("offering")) {
        offering += t.amount;
      } else if (cat.includes("tithe")) {
        tithes += t.amount;
      } else if (cat.includes("partner")) {
        partnerships += t.amount;
      } else if (cat.includes("first fruit")) {
        firstFruits += t.amount;
      } else {
        offering += t.amount;
      }
    });

    const total = offering + tithes + partnerships + firstFruits;
    return { offering, tithes, partnerships, firstFruits, total };
  }, [data.transactions, selectedDate, activeBranchId, branchObj.id, data.settings?.organization]);

  // Aggregate attendance: Pastors, Shepherds, Members per church, First Timers, FNF, Total
  const serviceAttendance = useMemo(() => {
    if (!selectedDate) {
      return {
        pastors: 0,
        shepherds: 0,
        countI: 0,
        countK: 0,
        countL: 0,
        countU: 0,
        countN: 0,
        firstTimers: 0,
        fnf: 0,
        totalAttendance: 0,
      };
    }

    const branchRecords = data.attendance.filter(
      (r) =>
        r.date === selectedDate &&
        matchesScope(r, activeBranchId || branchObj.id, data.settings?.organization)
    );

    const allPresentIds = new Set<string>();
    branchRecords.forEach((r) => {
      (r.presentMemberIds || []).forEach((id) => allPresentIds.add(id));
    });

    const presentMembersList: Member[] = [];
    allPresentIds.forEach((id) => {
      const mem = data.members.find((m) => m.id === id);
      if (mem) presentMembersList.push(mem);
    });

    // Pastors: Zonal Head, Branch Coordinator, Directorate Head
    const isPastor = (m: Member) =>
      m.role === "BRANCH_COORDINATOR" ||
      m.role === "ZONAL_HEAD" ||
      m.role === "DIRECTORATE_HEAD" ||
      m.role?.includes("COORDINATOR") ||
      m.role?.includes("PASTOR");

    // Shepherds: every other teacher within I, K, LJ, and UJ
    const isTeacher = (m: Member) =>
      ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
      m.type === MemberType.TEACHER ||
      (m.role && m.role !== "NONE");

    const isShepherd = (m: Member) => !isPastor(m) && isTeacher(m);

    let pastors = 0;
    let shepherds = 0;
    presentMembersList.forEach((m) => {
      if (isPastor(m)) pastors++;
      else if (isShepherd(m)) shepherds++;
    });

    // Count regular members per church (not teachers/pastors)
    const getChurchMembersCount = (cKey: string) => {
      const rec = branchRecords.find((r) => r.churchId === cKey);
      if (!rec) return 0;
      let c = 0;
      rec.presentMemberIds.forEach((id) => {
        const m = data.members.find((mem) => mem.id === id);
        if (m && !isPastor(m) && !isShepherd(m) && m.type === MemberType.MEMBER) {
          c++;
        }
      });
      return c;
    };

    const countI = getChurchMembersCount("I");
    const countK = getChurchMembersCount("K");
    const countL = getChurchMembersCount("LJ");
    const countU = getChurchMembersCount("UJ");
    const countN = getChurchMembersCount("N");

    let firstTimers = 0;
    let fnf = 0;
    presentMembersList.forEach((m) => {
      if (!isPastor(m) && !isShepherd(m)) {
        if (m.type === MemberType.VISITOR) firstTimers++;
        else if (m.type === MemberType.FNF) fnf++;
      }
    });

    const totalAttendance = presentMembersList.length;

    return {
      pastors,
      shepherds,
      countI,
      countK,
      countL,
      countU,
      countN,
      firstTimers,
      fnf,
      totalAttendance,
    };
  }, [data.attendance, data.members, selectedDate, activeBranchId, branchObj.id, data.settings?.organization]);

  const [activeTab, setActiveTab] = useState<
    "WHATSAPP" | "KPI" | "DIVISION" | "DATA" | "EXECUTIVE" | "ANNUAL"
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
  const availableChurches = Array.isArray(data.settings?.churches) ? data.settings?.churches : ["UJ", "LJ", "K", "I", "N"];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();
  const sundaysCurrentYear = getSundaysInYear(currentYear);
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const isSuperAdmin = isSuperAdminUser(currentUser);

  const visibleTabs = useMemo(() => {
    const all: { id: "WHATSAPP" | "KPI" | "DIVISION" | "DATA" | "EXECUTIVE" | "ANNUAL"; icon: any; label: string }[] = [
      { id: "WHATSAPP", icon: MessageCircle, label: "Report" },
      { id: "KPI", icon: Target, label: "KPIs" },
      { id: "DIVISION", icon: Users, label: "Teacher Division" },
      { id: "EXECUTIVE", icon: Briefcase, label: "Executive" },
      { id: "DATA", icon: Database, label: "Data" },
      { id: "ANNUAL", icon: Calendar, label: "Annual Record" },
    ];
    if (isSuperAdmin || currentUser.role === "ADMIN") return all;
    return all.filter((tab) => hasRoleSubfeature(data, currentUser.role || "", "Reports", tab.id));
  }, [data, currentUser.role, isSuperAdmin]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

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
    Promise.resolve();
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
          (activeChurch as string === "CM" || r.churchId === activeChurch),
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
          m.status !== MemberStatus.ARCHIVED &&
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
      } catch (err) { }
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
    if (!selectedDate) return "Please select a date to generate the report.";
    const parsedDate = new Date(selectedDate);
    const formattedDate = parsedDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const renderListWithServices = (members: Member[], title: string, record: any) => {
      let out = `*${title} (${members.length})*\n`;
      members.forEach((m, idx) => {
        out += `${idx + 1}. ${m.name}\n`;
      });
      return out + `\n`;
    };
    if (activeTab === "DIVISION") {
      return formatDivisionReportText(divisions);
    }

    const availableChurches = Array.isArray(data.settings?.churches)
      ? data.settings?.churches
      : ["UJ", "LJ", "K", "I", "N"];

    // Helper for outreach stats on selectedDate
    const getOutreachCounts = (filterFn: (item: any) => boolean) => {
      const sessions = (data.outreachSessions || []).filter(
        (s) => s.date === selectedDate && s.status === "COMPLETED" && filterFn(s)
      );
      const visits = sessions
        .filter((s) => s.sessionType === "VISIT" || !s.sessionType)
        .reduce((sum, s) => sum + (s.visitedMemberIds?.length || 0), 0);
      const calls = sessions
        .filter((s) => s.sessionType === "CALL" && s.outcome === "REACHED")
        .reduce((sum, s) => sum + (s.visitedMemberIds?.length || 0), 0);
      return { visits, calls };
    };

    // Helper for completed prayer count on selectedDate
    const getPrayerCount = (filterFn: (item: any) => boolean) => {
      const prayers = (data.prayerSchedule || []).filter(
        (p) => p.date === selectedDate && p.isCompleted && filterFn(p)
      );
      return prayers.length;
    };

    const userRole = currentUser.role || "";

    // =========================================================================
    // TIER 4: DIRECTORATE HEAD / ADMIN (Platform-Wide Aggregation Per Zone)
    // =========================================================================
    if (
      (userRole === "DIRECTORATE_HEAD" ||
        userRole === "SUPER_ADMIN" ||
        userRole === "ADMIN") &&
      (!activeBranchId || activeBranchId === "ALL") &&
      (activeChurch === "CM" || activeChurch === "All")
    ) {
      let report = `*CHILDREN'S MINISTRY DIRECTORATE REPORT*\n`;
      report += `${formattedDate}\n`;
      report += `============================\n\n`;

      const zones = data.settings.organization?.zones || [];
      let grandAttendance = 0;
      let grandFirstTimers = 0;
      let grandTeachers = 0;
      let grandVisits = 0;
      let grandCalls = 0;
      let grandPrayers = 0;
      let hasData = false;

      zones.forEach((zone) => {
        let zoneAttendance = 0;
        let zoneJoy = 0;
        let zoneEnlargement = 0;
        let zoneSpecial = 0;
        let zoneFirstTimers = 0;
        let zoneTeachers = 0;
        const branchSummaries: string[] = [];

        (zone.branches || []).forEach((branch) => {
          let branchAtt = 0;
          availableChurches.forEach((church) => {
            const rec = data.attendance.find(
              (r) =>
                r.date === selectedDate &&
                r.churchId === church &&
                (r.branchId === branch.id || r.branchId === branch.name || (!r.branchId && branch.id === "branch-main"))
            );
            if (rec) {
              branchAtt += rec.presentMemberIds.length;
              rec.presentMemberIds.forEach((id) => {
                const m = data.members.find((mem) => mem.id === id);
                if (m) {
                  if (m.type === MemberType.VISITOR) zoneFirstTimers++;
                  if (
                    ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
                    m.type === MemberType.TEACHER ||
                    (m.role && m.role !== "NONE")
                  ) {
                    zoneTeachers++;
                  } else {
                    const s = rec.serviceMap?.[m.id] || "JOY";
                    if (s === "JOY") zoneJoy++;
                    else if (s === "ENLARGEMENT") zoneEnlargement++;
                    else if (s === "SPECIAL") zoneSpecial++;
                  }
                }
              });
            }
          });
          if (branchAtt > 0) branchSummaries.push(`${branch.name}: ${branchAtt}`);
          zoneAttendance += branchAtt;
        });

        const zoneOutreach = getOutreachCounts((s) =>
          (zone.branches || []).some((b) => b.id === s.branchId || b.name === s.branchId)
        );
        const zonePrayer = getPrayerCount((p) =>
          (p.assignedMemberIds || []).some((id) => {
            const m = data.members.find((mem) => mem.id === id);
            return m && (m.zoneId === zone.id || (zone.branches || []).some((b) => b.id === m.branchId));
          })
        );

        if (zoneAttendance > 0 || zoneOutreach.visits > 0 || zonePrayer > 0) {
          hasData = true;
          report += `*ZONE: ${zone.name.toUpperCase()}*\n`;
          report += `• Total Attendance: ${zoneAttendance}\n`;
          report += `• Services: Joy (${zoneJoy}) | Enlargement (${zoneEnlargement})` + (zoneSpecial > 0 ? ` | Special (${zoneSpecial})` : "") + `\n`;
          report += `• Branches: ${branchSummaries.join(" | ") || "No branches"}\n`;
          report += `• First Timers: ${zoneFirstTimers} | Teachers: ${zoneTeachers}\n`;
          report += `• Outreach and Prayer: ${zoneOutreach.visits} Visits | ${zoneOutreach.calls} Calls | ${zonePrayer} Prayers\n\n`;
        }

        grandAttendance += zoneAttendance;
        grandFirstTimers += zoneFirstTimers;
        grandTeachers += zoneTeachers;
        grandVisits += zoneOutreach.visits;
        grandCalls += zoneOutreach.calls;
        grandPrayers += zonePrayer;
      });

      report += `============================\n`;
      report += `*DIRECTORATE GRAND TOTALS*\n`;
      report += `• Total Platform Attendance: ${grandAttendance}\n`;
      report += `• Total First Timers: ${grandFirstTimers}\n`;
      report += `• Total Active Teachers: ${grandTeachers}\n`;
      report += `• Total Outreach Activity: ${grandVisits} Visits | ${grandCalls} Calls\n`;
      report += `• Total Prayers Completed: ${grandPrayers}\n`;

      if (!hasData) {
        report += `\n_No attendance or outreach data recorded yet for this date._`;
      }
      return report.trim();
    }

    // =========================================================================
    // TIER 3: ZONAL HEAD (All Branches Under That Zone Aggregated)
    // =========================================================================
    if (
      userRole === "ZONAL_HEAD" ||
      (activeBranchId && activeBranchId.startsWith("ZONE:"))
    ) {
      const targetZoneId = activeBranchId?.startsWith("ZONE:")
        ? activeBranchId.replace("ZONE:", "")
        : currentUser.zoneId;

      const zone =
        data.settings.organization?.zones?.find(
          (z) => z.id === targetZoneId || z.name.toLowerCase() === (targetZoneId || "").toLowerCase()
        ) || data.settings.organization?.zones?.[0];

      const zoneName = zone?.name || "Zone";
      let report = `*${zoneName.toUpperCase()} - ZONAL SUMMARY REPORT*\n`;
      report += `${formattedDate}\n`;
      report += `============================\n\n`;

      let zoneTotalAtt = 0;
      let hasData = false;

      (zone?.branches || []).forEach((branch) => {
        let branchAtt = 0;
        let branchJoy = 0;
        let branchEnlargement = 0;
        let branchSpecial = 0;
        let branchKids = 0;
        let branchTeachers = 0;
        let branchFT = 0;
        const churchBreakdown: string[] = [];

        availableChurches.forEach((church) => {
          const rec = data.attendance.find(
            (r) =>
              r.date === selectedDate &&
              r.churchId === church &&
              (r.branchId === branch.id || r.branchId === branch.name || (!r.branchId && branch.id === "branch-main"))
          );
          if (rec) {
            const count = rec.presentMemberIds.length;
            branchAtt += count;
            if (count > 0) churchBreakdown.push(`${church}: ${count}`);
            rec.presentMemberIds.forEach((id) => {
              const m = data.members.find((mem) => mem.id === id);
              if (m) {
                if (m.type === MemberType.VISITOR) branchFT++;
                if (
                  ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
                  m.type === MemberType.TEACHER ||
                  (m.role && m.role !== "NONE")
                ) {
                  branchTeachers++;
                } else {
                  branchKids++;
                  const s = rec.serviceMap?.[m.id] || "JOY";
                  if (s === "JOY") branchJoy++;
                  else if (s === "ENLARGEMENT") branchEnlargement++;
                  else if (s === "SPECIAL") branchSpecial++;
                }
              }
            });
          }
        });

        if (branchAtt > 0) {
          hasData = true;
          report += `*BRANCH: ${branch.name}*\n`;
          if (churchBreakdown.length > 0) {
            churchBreakdown.forEach((cb) => {
              report += `• ${cb}\n`;
            });
          } else {
            report += `_No records_\n`;
          }
          report += `*Total Branch Attendance: ${branchAtt}*\n\n`;
        }

        zoneTotalAtt += branchAtt;
      });

      report += `============================\n`;
      report += `*${zoneName.toUpperCase()} TOTALS*\n`;
      report += `• Total Attendance: ${zoneTotalAtt}\n`;

      if (!hasData) {
        report += `\n_No attendance data recorded yet for this date._`;
      }
      return report.trim();
    }

    // =========================================================================
    // TIER 2: BRANCH COORDINATOR (Mega Center Service Reporting)
    // =========================================================================
    const generateBranchCoordinatorReport = () => {
      const parts = selectedDate.split("-");
      const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}.` : `${selectedDate}.`;
      const gc = (bcReportState.gcName || (branchObj.name || "THESAURUS")).toUpperCase().replace(/\s*BRANCH$/i, "");

      const effectiveOffering =
        bcReportState.offeringOverride !== undefined && bcReportState.offeringOverride !== ""
          ? bcReportState.offeringOverride
          : serviceFinances.offering;

      const effectiveTithes =
        bcReportState.tithesOverride !== undefined && bcReportState.tithesOverride !== ""
          ? bcReportState.tithesOverride
          : (serviceFinances.tithes > 0 ? serviceFinances.tithes : "");

      const effectivePartnerships =
        bcReportState.partnershipsOverride !== undefined && bcReportState.partnershipsOverride !== ""
          ? bcReportState.partnershipsOverride
          : (serviceFinances.partnerships > 0 ? serviceFinances.partnerships : "");

      const effectiveFirstFruits =
        bcReportState.firstFruitsOverride !== undefined && bcReportState.firstFruitsOverride !== ""
          ? bcReportState.firstFruitsOverride
          : (serviceFinances.firstFruits > 0 ? serviceFinances.firstFruits : "");

      const calcTotalFinance =
        (Number(effectiveOffering) || 0) +
        (Number(effectiveTithes) || 0) +
        (Number(effectivePartnerships) || 0) +
        (Number(effectiveFirstFruits) || 0);
      const effectiveTotalFinance = calcTotalFinance > 0 ? calcTotalFinance : (serviceFinances.total || 0);

      const effectiveNewMembers =
        bcReportState.newMembersOverride !== undefined && bcReportState.newMembersOverride !== ""
          ? bcReportState.newMembersOverride
          : autoNewMembersCount;

      const effectiveTotalSoulsWon =
        bcReportState.totalSoulsWonOverride !== undefined && bcReportState.totalSoulsWonOverride !== ""
          ? bcReportState.totalSoulsWonOverride
          : (Number(bcReportState.altarCall || 0) +
             Number(bcReportState.cellEvangelism || 0) +
             Number(bcReportState.outreachSouls || 0));

      const formatPreacherMessage = (preacher?: string, message?: string) => {
        const p = (preacher || "").trim();
        const m = (message || "").trim().toUpperCase();
        if (!p && !m) return " / ";
        if (p && !m) return `${p} / `;
        if (!p && m) return ` / ${m}`;
        return `${p} / ${m}`;
      };

      let r = `MEGA CENTER SERVICE\n`;
      r += `DATE: ${dateFormatted}\n\n`;
      r += `GC: ${gc}\n`;
      r += `TOTAL ATTENDANCE\n`;
      r += `PASTORS - ${serviceAttendance.pastors}\n`;
      r += `SHEPHERDS - ${serviceAttendance.shepherds}\n\n`;

      r += `MEMBERS:\n`;
      r += `I CHURCH - ${serviceAttendance.countI}\n`;
      r += `K CHURCH - ${serviceAttendance.countK}\n`;
      r += `L CHURCH - ${serviceAttendance.countL}\n`;
      r += `U CHURCH - ${serviceAttendance.countU}\n`;
      if (serviceAttendance.countN > 0) {
        r += `N CHURCH - ${serviceAttendance.countN}\n`;
      }
      r += `FIRST TIMERS - ${serviceAttendance.firstTimers}\n`;
      r += `FRIENDS AND FAMILY - ${serviceAttendance.fnf}\n\n`;

      r += `TOTAL ATTENDANCE : ${serviceAttendance.totalAttendance}\n\n`;

      r += `FINANCE\n`;
      r += `Offering: GHC ${effectiveOffering}\n`;
      r += `Tithes: ${effectiveTithes ? `GHC ${effectiveTithes}` : ""}\n`;
      r += `Partnerships: ${effectivePartnerships ? `GHC ${effectivePartnerships}` : ""}\n`;
      r += `First Fruits: ${effectiveFirstFruits ? `GHC ${effectiveFirstFruits}` : ""}\n\n`;
      r += `Total: GHC ${effectiveTotalFinance}\n\n`;

      r += `TIME SERVICE STARTED: ${bcReportState.serviceStarted || "9:00pm"}\n`;
      r += `TIME SERVICE ENDED: ${bcReportState.serviceEnded || "12:00pm"}\n\n`;

      r += `PREACHER / MESSAGE TITLE:\n`;
      r += `K CHURCH - ${formatPreacherMessage(bcReportState.preacherK, bcReportState.messageK)}\n`;
      r += `LJ CHURCH - ${formatPreacherMessage(bcReportState.preacherLJ, bcReportState.messageLJ)}\n`;
      r += `UJ-CHURCH - ${formatPreacherMessage(bcReportState.preacherUJ, bcReportState.messageUJ)}\n`;
      r += `I CHURCH - ${formatPreacherMessage(bcReportState.preacherI, bcReportState.messageI)}\n`;
      r += `NUMBER OF NEW MEMBERS - ${effectiveNewMembers}\n\n`;

      r += `SOUL WINNING REPORT\n`;
      r += `ALTAR CALL - ${bcReportState.altarCall || 0}\n`;
      r += `CELL EVANGELISM - ${bcReportState.cellEvangelism || 0}\n`;
      r += `OUTREACH - ${bcReportState.outreachSouls || 0}\n`;
      r += `TOTAL SOULS WON WITHIN THE WEEK - ${effectiveTotalSoulsWon}\n\n`;

      r += `CELL SYSTEM REPORT\n`;
      r += `NUMBER OF CELL MEETINGS HELD - ${bcReportState.cellMeetingsHeld || 0}\n`;
      r += `TOTAL CELL ATTENDANCE - ${bcReportState.totalCellAttendance || 0}\n\n`;

      r += `SPECTACULAR EVENT: ${bcReportState.spectacularEvent || ""}\n`;

      return r;
    };

    if (
      userRole === "BRANCH_COORDINATOR" ||
      reportFormat === "BRANCH_COORDINATOR" ||
      (userRole !== "TEACHER" && activeBranchId && !activeBranchId.startsWith("ZONE:") && activeBranchId !== "ALL") ||
      (activeChurch === "All" && userRole !== "TEACHER") ||
      (activeChurch === "CM" && userRole !== "TEACHER")
    ) {
      return generateBranchCoordinatorReport();
    }

    // =========================================================================
    // TIER 1: TEACHER / SINGLE CHURCH (Child names included in full detail)
    // =========================================================================
    function renderSingleChurch(churchId: string, branchObj?: { id?: string, name: string }) {
      const record = data.attendance.find(
        (r) => r.date === selectedDate && r.churchId === churchId && matchesScope(r, activeBranchId, data.settings.organization)
      );
      if (!record) return "";

      const presentMembers = data.members.filter((m) => record.presentMemberIds.includes(m.id));
      presentMembers.sort((a, b) => a.name.localeCompare(b.name));

      const teachers = presentMembers.filter(
        (m) =>
          ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
          m.type === MemberType.TEACHER ||
          (m.role && m.role !== "NONE"),
      );

      const allChildren = presentMembers.filter(
        (m) =>
          !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
          m.type !== MemberType.TEACHER &&
          (!m.role || m.role === "NONE"),
      );

      const globalEventName = data.attendance.find((r) => r.date === selectedDate && r.eventName)?.eventName;
      const eventNameToUse = record.eventName || globalEventName;

      const getService = (id: string) => record?.serviceMap?.[id] || "JOY";
      const totalJoy = allChildren.filter((m) => getService(m.id) === "JOY").length;
      const totalEnlargement = allChildren.filter((m) => getService(m.id) === "ENLARGEMENT").length;
      const totalSpecial = allChildren.filter((m) => getService(m.id) === "SPECIAL").length;
      const teachersCount = teachers.length;
      const totalCount = allChildren.length + teachersCount;

      let report = `*${churchId} CHURCH ATTENDANCE REPORT*\n${formattedDate}\n`;
      if (eventNameToUse) report += `*${eventNameToUse}*\n`;
      report += `------------------------------\n`;
      report += `*TOTAL PRESENT: ${totalCount}*\n`;

      const splits = [];
      if (eventNameToUse === "Joint Service") {
        const totalChildren = totalJoy + totalEnlargement + totalSpecial;
        if (totalChildren > 0) splits.push(`Joint Service: ${totalChildren}`);
      } else {
        if (totalJoy > 0) splits.push(`Joy Service: ${totalJoy}`);
        if (totalEnlargement > 0) splits.push(`Enlargement Service: ${totalEnlargement}`);
        if (totalSpecial > 0) splits.push(`${eventNameToUse || "Special"}: ${totalSpecial}`);
      }

      if (teachersCount > 0) splits.push(`Teachers: ${teachersCount}`);

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
      if (visitors.length > 0) report += renderListWithServices(visitors, "FIRST TIMERS", record);
      if (notMembers.length > 0) report += renderListWithServices(notMembers, "NOT A MEMBER", record);

      if (teachers.length > 0) {
        report += `*TEACHERS (${teachers.length})*\n`;
        teachers.forEach((m, i) => (report += `${i + 1}. ${m.name}\n`));
        report += `\n`;
      }

      return report.trim();
    }

    const currentBranchObj = currentUser.branchId
      ? { id: currentUser.branchId, name: currentUser.branchId }
      : undefined;

    let churchReport = renderSingleChurch(activeChurch, currentBranchObj);
    if (!churchReport)
      return `No attendance data recorded for ${selectedDate} in ${activeChurch} Church.`;
    let finalReport = churchReport;

    // Add Church Outreach and Prayer Summary
    const churchOutreach = getOutreachCounts((s) =>
      (s.assignedMemberIds || []).some((id) => {
        const m = data.members.find((mem) => mem.id === id);
        return m && m.assignedChurch === activeChurch;
      })
    );
    const churchPrayer = getPrayerCount((p) =>
      (p.assignedMemberIds || []).some((id) => {
        const m = data.members.find((mem) => mem.id === id);
        return m && m.assignedChurch === activeChurch;
      })
    );



    if (includeDivisionsInReport && ["UJ", "LJ", "K", "I"].includes(activeChurch)) {
      const divisionsData = calculateChurchDivisions(data.members, [activeChurch]);
      finalReport += `\n\n============================\n\n` + formatDivisionReportText(divisionsData);
    }
    return finalReport;
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
              Reports and Insights
            </h2>
            <p className="text-slate-500 font-medium">
              Generate updates and manage system data.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {visibleTabs.map((tab) => (
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
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Top Controls: Date, Format, Allocation Toggle */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                {isAdmin && (
                  <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setReportFormat("BRANCH_COORDINATOR")}
                      className={`px-3 py-1 rounded-lg transition-all ${reportFormat === "BRANCH_COORDINATOR" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      Branch Coordinator (Mega Center)
                    </button>
                    <button
                      onClick={() => setReportFormat("DEFAULT")}
                      className={`px-3 py-1 rounded-lg transition-all ${reportFormat === "DEFAULT" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      Summary / Detail
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIncludeDivisionsInReport(!includeDivisionsInReport)}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${includeDivisionsInReport ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
              >
                <Users size={14} />
                {includeDivisionsInReport ? "Teacher Divisions (ON)" : "Teacher Divisions (OFF)"}
              </button>
            </div>

            {/* Branch Coordinator Service Report Configuration Panel */}
            {(currentUser.role === "BRANCH_COORDINATOR" || reportFormat === "BRANCH_COORDINATOR" || isAdmin) && (
              <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden transition-all">
                <div
                  onClick={() => setShowBcEditor(!showBcEditor)}
                  className="p-4 bg-gradient-to-r from-indigo-50/70 to-slate-50 border-b border-indigo-100/60 flex items-center justify-between cursor-pointer select-none hover:bg-indigo-50/90 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                        Branch Coordinator Report Setup
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          Mega Center Template
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Configure preachers, sermon titles, soul winning, and cell stats for {selectedDate ? formatDateDDMMYYYY(selectedDate) : "selected Sunday"}.
                      </p>
                    </div>
                  </div>
                  <button className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                    {showBcEditor ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {showBcEditor && (
                  <div className="p-4 md:p-5 space-y-5 animate-in fade-in">
                    {/* Section 1: GC & Service Times */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                          <MapPin size={13} className="text-indigo-600" /> GC / Branch Name
                        </label>
                        <input
                          type="text"
                          value={bcReportState.gcName}
                          onChange={(e) => updateBcReportField("gcName", e.target.value.toUpperCase())}
                          placeholder="e.g. THESAURUS"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                          <Clock size={13} className="text-indigo-600" /> Time Service Started
                        </label>
                        <input
                          type="text"
                          value={bcReportState.serviceStarted}
                          onChange={(e) => updateBcReportField("serviceStarted", e.target.value)}
                          placeholder="e.g. 9:00pm"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                          <Clock size={13} className="text-indigo-600" /> Time Service Ended
                        </label>
                        <input
                          type="text"
                          value={bcReportState.serviceEnded}
                          onChange={(e) => updateBcReportField("serviceEnded", e.target.value)}
                          placeholder="e.g. 12:00pm"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Section 2: Preachers & Message Titles */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                          <BookOpen size={14} className="text-indigo-600" /> Preacher & Message Title by Church
                        </label>
                        <span className="text-[11px] text-slate-400">Message titles are automatically capitalized in the export</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* K Church */}
                        {(() => {
                          const teachers = teachersByChurch.K || [];
                          const p = bcReportState.preacherK;
                          const isCustom = p !== "" && !teachers.some((t) => t.name === p);
                          return (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                              <span className="font-extrabold text-xs text-indigo-900">K CHURCH</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Preacher</label>
                                  <select
                                    value={isCustom ? "__CUSTOM__" : p}
                                    onChange={(e) => {
                                      if (e.target.value === "__CUSTOM__") {
                                        updateBcReportField("preacherK", "Guest Preacher");
                                      } else {
                                        updateBcReportField("preacherK", e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                                  >
                                    <option value="">-- Select Teacher --</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                    <option value="__CUSTOM__">Other (Type Name)...</option>
                                  </select>
                                  {isCustom && (
                                    <input
                                      type="text"
                                      placeholder="Preacher name..."
                                      value={p}
                                      onChange={(e) => updateBcReportField("preacherK", e.target.value)}
                                      className="mt-1 w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Message Title</label>
                                  <input
                                    type="text"
                                    placeholder="Message title..."
                                    value={bcReportState.messageK}
                                    onChange={(e) => updateBcReportField("messageK", e.target.value)}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* LJ Church */}
                        {(() => {
                          const teachers = teachersByChurch.LJ || [];
                          const p = bcReportState.preacherLJ;
                          const isCustom = p !== "" && !teachers.some((t) => t.name === p);
                          return (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                              <span className="font-extrabold text-xs text-indigo-900">LJ CHURCH</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Preacher</label>
                                  <select
                                    value={isCustom ? "__CUSTOM__" : p}
                                    onChange={(e) => {
                                      if (e.target.value === "__CUSTOM__") {
                                        updateBcReportField("preacherLJ", "Guest Preacher");
                                      } else {
                                        updateBcReportField("preacherLJ", e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                                  >
                                    <option value="">-- Select Teacher --</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                    <option value="__CUSTOM__">Other (Type Name)...</option>
                                  </select>
                                  {isCustom && (
                                    <input
                                      type="text"
                                      placeholder="Preacher name..."
                                      value={p}
                                      onChange={(e) => updateBcReportField("preacherLJ", e.target.value)}
                                      className="mt-1 w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Message Title</label>
                                  <input
                                    type="text"
                                    placeholder="Message title..."
                                    value={bcReportState.messageLJ}
                                    onChange={(e) => updateBcReportField("messageLJ", e.target.value)}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* UJ-Church */}
                        {(() => {
                          const teachers = teachersByChurch.UJ || [];
                          const p = bcReportState.preacherUJ;
                          const isCustom = p !== "" && !teachers.some((t) => t.name === p);
                          return (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                              <span className="font-extrabold text-xs text-indigo-900">UJ-CHURCH</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Preacher</label>
                                  <select
                                    value={isCustom ? "__CUSTOM__" : p}
                                    onChange={(e) => {
                                      if (e.target.value === "__CUSTOM__") {
                                        updateBcReportField("preacherUJ", "Guest Preacher");
                                      } else {
                                        updateBcReportField("preacherUJ", e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                                  >
                                    <option value="">-- Select Teacher --</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                    <option value="__CUSTOM__">Other (Type Name)...</option>
                                  </select>
                                  {isCustom && (
                                    <input
                                      type="text"
                                      placeholder="Preacher name..."
                                      value={p}
                                      onChange={(e) => updateBcReportField("preacherUJ", e.target.value)}
                                      className="mt-1 w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Message Title</label>
                                  <input
                                    type="text"
                                    placeholder="Message title..."
                                    value={bcReportState.messageUJ}
                                    onChange={(e) => updateBcReportField("messageUJ", e.target.value)}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* I Church */}
                        {(() => {
                          const teachers = teachersByChurch.I || [];
                          const p = bcReportState.preacherI;
                          const isCustom = p !== "" && !teachers.some((t) => t.name === p);
                          return (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                              <span className="font-extrabold text-xs text-indigo-900">I CHURCH</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Preacher</label>
                                  <select
                                    value={isCustom ? "__CUSTOM__" : p}
                                    onChange={(e) => {
                                      if (e.target.value === "__CUSTOM__") {
                                        updateBcReportField("preacherI", "Guest Preacher");
                                      } else {
                                        updateBcReportField("preacherI", e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                                  >
                                    <option value="">-- Select Teacher --</option>
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                    <option value="__CUSTOM__">Other (Type Name)...</option>
                                  </select>
                                  {isCustom && (
                                    <input
                                      type="text"
                                      placeholder="Preacher name..."
                                      value={p}
                                      onChange={(e) => updateBcReportField("preacherI", e.target.value)}
                                      className="mt-1 w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Message Title</label>
                                  <input
                                    type="text"
                                    placeholder="Message title..."
                                    value={bcReportState.messageI}
                                    onChange={(e) => updateBcReportField("messageI", e.target.value)}
                                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Number of New Members */}
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                            <Users size={14} className="text-indigo-600" /> Number of New Members
                          </label>
                          <p className="text-[11px] text-slate-500">
                            Auto-counted from children made members on this Sunday across all churches:{" "}
                            <span className="font-bold text-indigo-700">{autoNewMembersCount}</span>
                          </p>
                        </div>
                        <input
                          type="number"
                          value={bcReportState.newMembersOverride !== undefined && bcReportState.newMembersOverride !== "" ? bcReportState.newMembersOverride : autoNewMembersCount}
                          onChange={(e) => updateBcReportField("newMembersOverride", e.target.value)}
                          className="w-24 p-2 bg-white border border-indigo-200 rounded-lg font-extrabold text-sm text-center text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Section 3: Soul Winning & Cell System */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Soul Winning Report */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase">
                          <Flame size={14} className="text-amber-500" /> Soul Winning Report
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Altar Call</label>
                            <input
                              type="number"
                              min="0"
                              value={bcReportState.altarCall}
                              onChange={(e) => updateBcReportField("altarCall", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Cell Evan.</label>
                            <input
                              type="number"
                              min="0"
                              value={bcReportState.cellEvangelism}
                              onChange={(e) => updateBcReportField("cellEvangelism", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Outreach</label>
                            <input
                              type="number"
                              min="0"
                              value={bcReportState.outreachSouls}
                              onChange={(e) => updateBcReportField("outreachSouls", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-600">Total Souls Won (Week):</span>
                          <span className="font-extrabold text-indigo-600 text-sm">
                            {bcReportState.totalSoulsWonOverride !== undefined && bcReportState.totalSoulsWonOverride !== ""
                              ? bcReportState.totalSoulsWonOverride
                              : Number(bcReportState.altarCall || 0) + Number(bcReportState.cellEvangelism || 0) + Number(bcReportState.outreachSouls || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Cell System Report */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase">
                          <Users size={14} className="text-indigo-600" /> Cell System Report
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Meetings Held</label>
                            <input
                              type="number"
                              min="0"
                              value={bcReportState.cellMeetingsHeld}
                              onChange={(e) => updateBcReportField("cellMeetingsHeld", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Cell Attendance</label>
                            <input
                              type="number"
                              min="0"
                              value={bcReportState.totalCellAttendance}
                              onChange={(e) => updateBcReportField("totalCellAttendance", parseInt(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-center text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 italic pt-1">When there is none, 0 is recorded automatically.</p>
                      </div>
                    </div>

                    {/* Section 4: Spectacular Event */}
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">
                        Spectacular Event Highlights
                      </label>
                      <textarea
                        rows={2}
                        value={bcReportState.spectacularEvent}
                        onChange={(e) => updateBcReportField("spectacularEvent", e.target.value)}
                        placeholder="Notable moments, praise reports, testimonies, special visitations..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium"
                      />
                    </div>

                    {/* Section 5: Finances Overview & Overrides */}
                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5 uppercase">
                          <DollarSign size={14} className="text-emerald-600" /> Service Finance Summary (Auto-Aggregated)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                          Live from Treasury
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Offering</span>
                          <span className="font-extrabold text-slate-800">GH₵ {serviceFinances.offering}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Tithes</span>
                          <span className="font-extrabold text-slate-800">GH₵ {serviceFinances.tithes}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Partnerships</span>
                          <span className="font-extrabold text-slate-800">GH₵ {serviceFinances.partnerships}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">First Fruits</span>
                          <span className="font-extrabold text-slate-800">GH₵ {serviceFinances.firstFruits}</span>
                        </div>
                        <div className="bg-emerald-600 p-2 rounded-lg text-white text-center col-span-2 sm:col-span-1 shadow-sm">
                          <span className="block text-[10px] text-emerald-100 font-bold uppercase">Total</span>
                          <span className="font-extrabold text-sm">GH₵ {serviceFinances.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Monospace Report Preview */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap h-64 sm:h-96 overflow-y-auto shadow-inner">
              {generateReport()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCopyReport}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${copiedReport ? "bg-green-600 text-white shadow-lg shadow-green-200" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {copiedReport ? <CheckCircle size={18} /> : <Copy size={18} />}
                <span className="text-sm">{copiedReport ? "Copied!" : "Copy"}</span>
              </button>
              <button
                onClick={handleOpenWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20bd5a] shadow-lg shadow-green-100 transition-all active:scale-95"
              >
                <MessageCircle size={18} /> <span className="text-sm">WhatsApp</span>
              </button>
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
        {activeTab === "ANNUAL" && <AnnualViewTab selectedDate={selectedDate} data={data} activeChurch={activeChurch} CHURCH_NAMES={CHURCH_NAMES} />}
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


function AnnualViewTab({ selectedDate, data, activeChurch, CHURCH_NAMES }: any) {
  const year = new Date(selectedDate || new Date()).getFullYear();
  const [annualContent, setAnnualContent] = React.useState("");
  const [copiedAnnual, setCopiedAnnual] = React.useState(false);

  const [copiedDetailedAnnual, setCopiedDetailedAnnual] = React.useState(false);

  const handleCopyDetailedAnnual = () => {
    let result = `*${year} DETAILED ATTENDANCE RECORD*\n\n`;

    const recordsForYear = data.attendance.filter((r: any) => r.date.startsWith(String(year)));
    const uniqueDates = Array.from(new Set(recordsForYear.map((r: any) => r.date))).sort();

    if (uniqueDates.length === 0) {
      result += `No attendance records found for ${year}.`;
    } else {
      const availableChurches = ["UJ", "LJ", "K", "I", "N"];
      const churchesToCheck = activeChurch === "CM" ? availableChurches : [activeChurch];

      uniqueDates.forEach((dateStr: any) => {
        const displayDate = new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" });

        let dateHasRecords = false;
        let dateContent = `============================\n`;
        dateContent += `*${displayDate.toUpperCase()}*\n`;
        dateContent += `============================\n\n`;

        churchesToCheck.forEach((church: any) => {
          const churchRecords = recordsForYear.filter((r: any) => r.date === dateStr && r.churchId === church);
          const churchName = CHURCH_NAMES[church] || church;

          churchRecords.forEach((rec: any) => {
            const presentMembers = data.members.filter((m: any) => rec.presentMemberIds.includes(m.id));
            presentMembers.sort((a: any, b: any) => a.name.localeCompare(b.name));
            if (presentMembers.length > 0) {
              dateHasRecords = true;

              const teachers = presentMembers.filter(
                (m: any) =>
                  ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
                  m.type === "Teacher"
              );
              const allChildren = presentMembers.filter(
                (m: any) =>
                  !["Teacher", "Helper", "Volunteer"].includes(m.type) &&
                  m.type !== "Teacher"
              );

              const getService = (id: string) => rec.serviceMap?.[id] || "JOY";
              const totalJoy = allChildren.filter((m: any) => getService(m.id) === "JOY").length;
              const totalEnlargement = allChildren.filter((m: any) => getService(m.id) === "ENLARGEMENT").length;
              const totalSpecial = allChildren.filter((m: any) => getService(m.id) === "SPECIAL").length;

              const teachersCount = teachers.length;
              const totalCount = allChildren.length + teachersCount;

              const eventNameToUse = rec.eventName || "";

              let report = `*${churchName} CHURCH ATTENDANCE REPORT*\n`;
              if (eventNameToUse) report += `*${eventNameToUse}*\n`;
              report += `--------------------------\n`;
              report += `*TOTAL PRESENT: ${totalCount}*\n`;

              const splits = [];
              if (eventNameToUse === "Joint Service") {
                const totalChildren = totalJoy + totalEnlargement + totalSpecial;
                if (totalChildren > 0) splits.push(`Joint Service: ${totalChildren}`);
              } else {
                if (totalJoy > 0) splits.push(`Joy Service: ${totalJoy}`);
                if (totalEnlargement > 0) splits.push(`Enlargement Service: ${totalEnlargement}`);
                if (totalSpecial > 0) splits.push(`${eventNameToUse || "Special"}: ${totalSpecial}`);
              }

              if (teachersCount > 0) splits.push(`Teachers: ${teachersCount}`);

              if (splits.length > 0) {
                report += `(${splits.join(" | ")})\n\n`;
              } else {
                report += `\n`;
              }

              const renderList = (membersList: any[], title: string) => {
                let out = `*${title} (${membersList.length})*\n`;
                membersList.forEach((m: any, idx: number) => {
                  out += `${idx + 1}. ${m.name}\n`;
                });
                return out + `\n`;
              };

              const members = allChildren.filter((m: any) => m.type === "Member");
              const fnfs = allChildren.filter((m: any) => m.type === "FNF");
              const visitors = allChildren.filter((m: any) => m.type === "Visitor");
              const notMembers = allChildren.filter((m: any) => m.type === "Not Member");

              if (members.length > 0) report += renderList(members, "MEMBERS");
              else report += `*MEMBERS (0)*\n_None_\n\n`;

              if (fnfs.length > 0) report += renderList(fnfs, "FNF");
              if (visitors.length > 0) report += renderList(visitors, "FIRST TIMERS");
              if (notMembers.length > 0) report += renderList(notMembers, "NOT A MEMBER");

              if (teachers.length > 0) {
                report += `*TEACHERS (${teachers.length})*\n`;
                teachers.forEach((m: any, i: number) => (report += `${i + 1}. ${m.name}\n`));
                report += `\n`;
              }

              dateContent += report + `\n`;
            }
          });
        });

        if (dateHasRecords) {
          result += dateContent;
        }
      });
    }

    navigator.clipboard.writeText(result.trim());
    setCopiedDetailedAnnual(true);
    setTimeout(() => setCopiedDetailedAnnual(false), 2000);
  };


  React.useEffect(() => {
    let result = `*${year} ATTENDANCE RECORD*\n\n`;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const sundays = [];

    let d = new Date(startDate);
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }

    while (d <= endDate) {
      sundays.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }

    const availableChurches = ["UJ", "LJ", "K", "I", "N"];
    const churchesToCheck = activeChurch === "CM" ? availableChurches : [activeChurch];

    sundays.forEach((sunday: any) => {
      const y = sunday.getFullYear();
      const m = String(sunday.getMonth() + 1).padStart(2, '0');
      const dStr = String(sunday.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dStr}`;

      const displayDate = sunday.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" });

      let hasAnyRecord = false;
      let dayReport = `*${displayDate}*\n`;

      churchesToCheck.forEach((church: any) => {
        const rec = data.attendance.find((r: any) => r.date === dateStr && r.churchId === church);
        const churchName = CHURCH_NAMES[church] || church;
        if (rec) {
          dayReport += `${churchName}: ✅ Record exists (${rec.presentMemberIds.length} present)\n`;
          hasAnyRecord = true;
        } else {
          dayReport += `${churchName}: ❌ No Record\n`;
        }
      });

      if (hasAnyRecord || churchesToCheck.length === 1) {
        result += dayReport + `\n`;
      } else {
        result += `*${displayDate}*\n❌ No CM Records\n\n`;
      }
    });

    setAnnualContent(result.trim());
  }, [year, data.attendance, activeChurch, CHURCH_NAMES]);

  const handleCopyAnnual = () => {
    navigator.clipboard.writeText(annualContent);
    setCopiedAnnual(true);
    setTimeout(() => setCopiedAnnual(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm">{year} Annual Record Tracking</h3>
        </div>
        <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
            {annualContent}
          </pre>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
          <button
            onClick={handleCopyAnnual}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedAnnual ? <CheckCircle size={18} /> : <Copy size={18} />}
            {copiedAnnual ? "Copied" : "Summary"}
          </button>
          <button
            onClick={handleCopyDetailedAnnual}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            {copiedDetailedAnnual ? <CheckCircle size={18} /> : <FileText size={18} />}
            {copiedDetailedAnnual ? "Copied Detailed" : "Detailed Export"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default React.memo(ReportExport);
