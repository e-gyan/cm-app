import React, { useState, useMemo, useEffect } from "react";
import { AppData, Church, Member, MemberType, MemberStatus } from "../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Calendar,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Activity,
  MessageCircle,
  Share2,
  MapPin,
  Heart,
  HeartHandshake,
  Sparkles,
  Loader2,
  RefreshCw,
  Wallet,
  X,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import * as d3 from "d3";

interface AnalyticsHubProps {
  data: AppData;
  activeChurch: Church;
  currentUser: Member;
}

type TimeRange = "2W" | "1M" | "3M" | "YTD" | "1Y";

const calculateAge = (birthDateString?: string) => {
  if (!birthDateString) return null;
  let parts = birthDateString.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const bd = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (isNaN(bd.getTime())) return null;
    const ageDifMs = Date.now() - bd.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }
  const bd = new Date(birthDateString);
  if (!isNaN(bd.getTime())) {
    const ageDifMs = Date.now() - bd.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }
  return null;
};

const DemographicsChart = ({
  members,
  effectiveChurch,
}: {
  members: Member[];
  effectiveChurch: string;
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 250 });

  useEffect(() => {
    const observeTarget = containerRef.current;
    if (!observeTarget) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height > 0 ? entry.contentRect.height : 250,
        });
      }
    });
    resizeObserver.observe(observeTarget);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const filtered = members.filter((m) =>
      effectiveChurch === "All" ? true : m.assignedChurch === effectiveChurch,
    );

    let ageData = [
      { group: "0-5", count: 0 },
      { group: "6-9", count: 0 },
      { group: "10-12", count: 0 },
      { group: "13-15", count: 0 },
      { group: "16-19", count: 0 },
      { group: "20+", count: 0 },
      { group: "Unknown", count: 0 },
    ];

    filtered.forEach((m) => {
      const age = calculateAge(m.birthDate);
      if (age === null) ageData[6].count++;
      else if (age <= 5) ageData[0].count++;
      else if (age <= 9) ageData[1].count++;
      else if (age <= 12) ageData[2].count++;
      else if (age <= 15) ageData[3].count++;
      else if (age <= 19) ageData[4].count++;
      else ageData[5].count++;
    });

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const selection = d3.select(svgRef.current);
    selection.selectAll("*").remove();

    // preserve aspect ratio and enable scaling
    selection
      .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const svg = selection
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(ageData.map((d) => d.group))
      .padding(0.2);

    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", "#64748b")
      .style("font-size", "12px");

    svg.selectAll(".domain, .tick line").attr("stroke", "#e2e8f0");

    const maxCount = d3.max(ageData, (d) => d.count) || 10;
    const y = d3.scaleLinear().domain([0, maxCount]).range([height, 0]);

    svg
      .append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .attr("fill", "#64748b")
      .style("font-size", "12px");

    svg.selectAll(".domain").attr("stroke", "transparent");
    svg
      .selectAll(".tick line")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-dasharray", "3 3");

    const tooltip = d3
      .select(svgRef.current.parentNode as any)
      .append("div")
      .style("position", "absolute")
      .style("padding", "8px")
      .style("background", "white")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1)");

    svg
      .selectAll("mybar")
      .data(ageData)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.group)!)
      .attr("y", height)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", "#8b5cf6")
      .attr("rx", 4)
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip
          .html(`<b>${d.group}</b>: ${d.count} members`)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .transition()
      .duration(800)
      .attr("y", (d) => y(d.count))
      .attr("height", (d) => height - y(d.count))
      .delay((d, i) => i * 100);

    return () => {
      d3.select(svgRef.current?.parentNode as any)
        .selectAll("div")
        .remove();
    };
  }, [members, effectiveChurch, dimensions]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative flex items-center justify-center"
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ maxHeight: "250px" }}
      ></svg>
    </div>
  );
};

const AttendanceHeatmap = ({
  year,
  attendance,
  effectiveChurch,
}: {
  year: number;
  attendance: any[];
  effectiveChurch: string;
}) => {
  const records =
    effectiveChurch === "All"
      ? attendance
      : attendance.filter((a) => a.churchId === effectiveChurch);

  const attendanceMap = new Map<string, { count: number }>();

  records.forEach((r) => {
    const d = new Date(r.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const count = r.presentMemberIds?.length || 0;

    if (attendanceMap.has(dateStr)) {
      attendanceMap.get(dateStr)!.count += count;
    } else {
      attendanceMap.set(dateStr, { count });
    }
  });

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const days = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    days.push({
      date: new Date(current),
      dateStr,
      attendance: attendanceMap.get(dateStr),
    });
    current.setDate(current.getDate() + 1);
  }

  const values = Array.from(attendanceMap.values())
    .map((v) => v.count)
    .filter((c) => c > 0);
  const maxVal = values.length > 0 ? Math.max(...values) : 1;
  const minVal = values.length > 0 ? Math.min(...values) : 1;

  const getColor = (count?: number) => {
    if (count === undefined) return "bg-slate-100";
    if (count === 0) return "bg-slate-100"; // Or another color if zero is considered an event

    const ratio = (count - minVal) / (maxVal - minVal || 1);
    if (ratio < 0.2) return "bg-indigo-300";
    if (ratio < 0.5) return "bg-indigo-400";
    if (ratio < 0.8) return "bg-indigo-500";
    return "bg-indigo-700";
  };

  const startWeekDay = startDate.getDay();
  const weeks: any[][] = [];
  let currentWeek: any[] = [];

  for (let i = 0; i < startWeekDay; i++) {
    currentWeek.push(null);
  }

  days.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div className="overflow-x-auto no-scrollbar py-2">
      <div className="min-w-fit flex">
        <div className="flex flex-col text-[10px] text-slate-400 font-medium justify-between pr-2 py-1 select-none h-32">
          <span className="h-4 flex items-center">Sun</span>
          <span className="h-4 flex items-center">Mon</span>
          <span className="h-4 flex items-center">Tue</span>
          <span className="h-4 flex items-center">Wed</span>
          <span className="h-4 flex items-center">Thu</span>
          <span className="h-4 flex items-center">Fri</span>
          <span className="h-4 flex items-center">Sat</span>
        </div>

        <div className="flex gap-1 relative h-32">
          {weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-1">
              {week.map((day, j) => {
                if (!day)
                  return (
                    <div
                      key={j}
                      className="w-4 h-4 rounded-sm bg-transparent"
                    ></div>
                  );
                const isLow =
                  day.attendance && day.attendance.count < maxVal * 0.25;

                return (
                  <div
                    key={j}
                    className={`w-4 h-4 rounded-sm ${getColor(day.attendance?.count)} 
                                            ${isLow ? "ring-2 ring-red-400 ring-offset-1" : ""} 
                                            hover:ring-2 hover:ring-indigo-500 transition-all group relative cursor-pointer`}
                  >
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap z-50">
                      <div className="font-bold">{day.date.toDateString()}</div>
                      {day.attendance ? (
                        <div>{day.attendance.count} members</div>
                      ) : (
                        <div>No Records</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm bg-slate-100"></div>
            <div className="w-4 h-4 rounded-sm bg-indigo-300"></div>
            <div className="w-4 h-4 rounded-sm bg-indigo-400"></div>
            <div className="w-4 h-4 rounded-sm bg-indigo-500"></div>
            <div className="w-4 h-4 rounded-sm bg-indigo-700"></div>
          </div>
          <span>More</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-red-400 rounded-sm"></div>{" "}
            Lowest 25% Participation
          </span>
        </div>
      </div>
    </div>
  );
};

const AnalyticsHub: React.FC<AnalyticsHubProps> = ({
  data,
  activeChurch,
  currentUser,
}) => {
  const hasManagementView = [
    "SUPER_ADMIN",
    "ADMIN",
    "DIRECTORATE_HEAD",
    "ZONAL_HEAD",
    "CM",
  ].includes(currentUser.role || "");
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const isCM = currentUser.role === "CM";
  const isUJTeacher = currentUser.role === "TEACHER" && activeChurch === "UJ";

  // Use dynamic list from settings
  const availableChurches = data.settings.churches;

  // --- STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem("analytics_year");
    return saved ? parseInt(saved) : new Date().getFullYear();
  });
  const [timeRange, setTimeRange] = useState<TimeRange>(
    () => (localStorage.getItem("analytics_timeRange") as TimeRange) || "1M",
  );
  const [adminFilterChurch, setAdminFilterChurch] = useState<Church | "All">(
    () =>
      (localStorage.getItem("analytics_churchFilter") as Church | "All") ||
      "All",
  );

  // Persist State
  useEffect(() => {
    localStorage.setItem("analytics_year", selectedYear.toString());
  }, [selectedYear]);
  useEffect(() => {
    localStorage.setItem("analytics_timeRange", timeRange);
  }, [timeRange]);
  useEffect(() => {
    localStorage.setItem("analytics_churchFilter", adminFilterChurch);
  }, [adminFilterChurch]);

  // AI State
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedChartDate, setSelectedChartDate] = useState<{
    date: string;
    presentIds: string[];
  } | null>(null);

  // --- HELPERS ---
  const effectiveChurch = hasManagementView ? adminFilterChurch : activeChurch;

  const getAvailableYears = () => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    data.attendance.forEach((r) => years.add(new Date(r.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  };

  const getDateRange = () => {
    const end = new Date(); // Today default
    // If selected year is previous, end date is Dec 31 of that year
    if (selectedYear !== new Date().getFullYear()) {
      end.setFullYear(selectedYear, 11, 31);
    }
    end.setHours(23, 59, 59, 999); // End of day inclusive

    const start = new Date(end);

    switch (timeRange) {
      case "2W":
        start.setDate(end.getDate() - 14);
        break;
      case "1M":
        start.setMonth(end.getMonth() - 1);
        break;
      case "3M":
        start.setMonth(end.getMonth() - 3);
        break;
      case "YTD":
        start.setFullYear(selectedYear, 0, 1);
        break;
      case "1Y":
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    start.setHours(0, 0, 0, 0); // Start of day inclusive

    return { start, end };
  };

  // --- DATA PROCESSING ---

  // 1. Attendance Data for Charts
  const chartData = useMemo(() => {
    const { start, end } = getDateRange();

    // Filter records strictly within range
    let records = data.attendance.filter((r) => {
      const d = new Date(r.date);
      const churchMatch =
        effectiveChurch === "All" ? true : r.churchId === effectiveChurch;
      return d >= start && d <= end && churchMatch;
    });

    // Sort chronological
    records.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Group by Date (handles combined view having multiple records per date)
    const groupedByDate = new Map<
      string,
      {
        date: string;
        dateObj: Date;
        Member: number;
        FNF: number;
        Inconsistent: number;
        Total: number;
        presentIds: string[];
      }
    >();

    records.forEach((r) => {
      // Normalize date string to ensure grouping by day
      const dateKey = r.date;

      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, {
          date: new Date(r.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          dateObj: new Date(r.date),
          Member: 0,
          FNF: 0,
          Inconsistent: 0,
          Total: 0,
          presentIds: [],
        });
      }

      const entry = groupedByDate.get(dateKey)!;

      // Count all attendees including teachers
      r.presentMemberIds.forEach((id) => {
        const m = data.members.find((mem) => mem.id === id);
        if (m) {
          entry.Total++;
          entry.presentIds.push(id);
          const isTeacher =
            ["Teacher", "Helper", "Volunteer"].includes(m.type) ||
            m.type === MemberType.TEACHER;
          if (m.type === MemberType.MEMBER || isTeacher) entry.Member++;
          else if (m.type === MemberType.FNF || m.type === MemberType.VISITOR)
            entry.FNF++;
          else entry.Inconsistent++;
        }
      });
    });

    return Array.from(groupedByDate.values());
  }, [data.attendance, effectiveChurch, timeRange, selectedYear, data.members]);

  // 2. High Level KPI
  const stats = useMemo(() => {
    if (chartData.length === 0)
      return { avg: 0, growth: 0, retention: 0, newFaces: 0 };

    const totalAtt = chartData.reduce((acc, d) => acc + d.Total, 0);
    const avg = Math.round(totalAtt / chartData.length);

    // Growth (Compare first half vs second half of period roughly)
    const mid = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, mid);
    const secondHalf = chartData.slice(mid);

    const avg1 = firstHalf.length
      ? firstHalf.reduce((a, b) => a + b.Total, 0) / firstHalf.length
      : 0;
    const avg2 = secondHalf.length
      ? secondHalf.reduce((a, b) => a + b.Total, 0) / secondHalf.length
      : 0;

    const growth =
      avg1 === 0
        ? avg2 > 0
          ? 100
          : 0
        : Math.round(((avg2 - avg1) / avg1) * 100);

    // Simple Retention Proxy: Active Members vs Total
    const totalMembersAttended = chartData.reduce(
      (acc, d) => acc + d.Member,
      0,
    );
    const retention =
      totalAtt > 0 ? Math.round((totalMembersAttended / totalAtt) * 100) : 0;

    // New Faces Proxy (Average FNF count)
    const newFaces = Math.round(
      chartData.reduce((acc, d) => acc + d.FNF, 0) / chartData.length,
    );

    return { avg, growth, retention, newFaces };
  }, [chartData]);

  // 6. Management Overview
  const managementOverview = useMemo(() => {
    if (!hasManagementView) return null;
    const { start, end } = getDateRange();
    const churchStats: Record<
      string,
      {
        totalKids: number;
        services: Record<string, { teachersCount: number; kidsCount: number }>;
      }
    > = {};

    availableChurches.forEach((c) => {
      churchStats[c] = { totalKids: 0, services: {} };
    });

    const records = data.attendance.filter((r) => {
      const d = new Date(r.date);
      return d >= start && d <= end && availableChurches.includes(r.churchId);
    });

    records.forEach((record) => {
      if (!churchStats[record.churchId]) return;
      const map = record.serviceMap || {};

      record.presentMemberIds.forEach((id) => {
        const m = data.members.find((mem) => mem.id === id);
        if (!m) return;
        const isStaff = ["Teacher", "Helper", "Volunteer"].includes(m.type);
        const service = map[id] || "JOY";

        if (!churchStats[record.churchId].services[service]) {
          churchStats[record.churchId].services[service] = {
            teachersCount: 0,
            kidsCount: 0,
          };
        }

        if (isStaff) {
          churchStats[record.churchId].services[service].teachersCount++;
          churchStats[record.churchId].totalKids++;
        } else if (["Active", "Not Active"].includes(m.status)) {
          churchStats[record.churchId].services[service].kidsCount++;
          churchStats[record.churchId].totalKids++;
        }
      });
    });
    return churchStats;
  }, [data, timeRange, selectedYear, hasManagementView, availableChurches]);

  // --- AI GENERATION ---
  const generateInsight = async () => {
    if (chartData.length < 2) {
      setAiInsight(
        "Not enough data points in this period to generate a trend analysis.",
      );
      return;
    }

    setIsGenerating(true);
    const { start, end } = getDateRange();
    const dateRangeStr = `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;

    const prompt = `
        Act as a helpful ministry assistant.
        Analyze this attendance data for the period "${dateRangeStr}" (Filter: ${timeRange}):
        - Average Attendance: ${stats.avg}
        - Growth vs previous half of period: ${stats.growth}%
        - Retention Rate: ${stats.retention}%
        - New Visitors avg: ${stats.newFaces}
        - Data Points: ${JSON.stringify(chartData.map((d) => ({ date: d.date, total: d.Total })))}

        Instructions:
        1. Provide a simple, down-to-earth insight about the attendance trends specifically for this date range.
        2. Keep it encouraging but honest. Focus on what the data actually says.
        3. Keep it under 2 sentences. Be direct and easy to understand.
      `;

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const res = await fetch("/api/generate-insight", {
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
        setAiInsight(responseData.text || "Could not generate insight.");
        break; // Success, exit loop
      } catch (e: any) {
        console.error(`AI Gen Attempt ${retryCount + 1} Error:`, e);
        retryCount++;

        // Check for 503 or 429 errors (High Demand / Rate Limit)
        const isOverloaded =
          e.status === 503 ||
          e.message?.includes("503") ||
          e.status === 429 ||
          e.message?.includes("429");

        // Avoid retrying for 400 Bad Request (like missing API Keys)
        const isBadRequest =
          e.message?.includes("400") ||
          e.message?.includes("API key is not configured");

        if (isBadRequest) {
          setAiInsight(e.message);
          break;
        }

        if (isOverloaded && retryCount < maxRetries) {
          // Exponential backoff: 1s, 2s...
          await new Promise((res) => setTimeout(res, 1000 * retryCount));
          continue;
        }

        if (retryCount === maxRetries) {
          if (isOverloaded) {
            setAiInsight(
              "System is currently experiencing high traffic. Please try again in a minute.",
            );
          } else {
            let cleanMsg = e.message;
            try {
              const parsed = JSON.parse(e.message);
              if (parsed.error && parsed.error.message) {
                cleanMsg = parsed.error.message;
              }
            } catch (err) {}
            setAiInsight(`Could not generate insight: ${cleanMsg}`);
          }
        }
      }
    }
    setIsGenerating(false);
  };

  // Debounced Effect to trigger AI when stats change
  // We removed the auto-trigger to save API quotas
  useEffect(() => {
    // Clear the insight when data changes to let the user generate a new one manually
    if (aiInsight && !aiInsight.includes("Traffic")) {
      setAiInsight("");
    }
  }, [stats, timeRange, effectiveChurch]);

  // 3. UJ Outreach Intelligence
  const outreachIntel = useMemo(() => {
    if (!isUJTeacher && effectiveChurch !== "UJ") return null;

    const { start, end } = getDateRange();
    const ujMembers = data.members.filter(
      (m) =>
        m.assignedChurch === "UJ" &&
        ["Member", "FNF", "Inconsistent"].includes(m.type) &&
        m.status === MemberStatus.ACTIVE,
    );
    const totalEligible = ujMembers.length;

    // Visits in period
    const visits = (data.outreachSessions || []).filter((s) => {
      const d = new Date(s.date);
      return d >= start && d <= end && s.status === "COMPLETED";
    });

    const visitedIds = new Set<string>();
    visits.forEach((s) =>
      s.visitedMemberIds?.forEach((id) => visitedIds.add(id)),
    );

    const visitCoverage =
      totalEligible > 0
        ? Math.round((visitedIds.size / totalEligible) * 100)
        : 0;

    // Prayers in period
    const prayers = (data.prayerSchedule || []).filter((s) => {
      const d = new Date(s.date);
      return d >= start && d <= end && s.isCompleted;
    });

    const prayedIds = new Set<string>();
    prayers.forEach((s) =>
      s.assignedMemberIds.forEach((id) => prayedIds.add(id)),
    );

    const prayerCoverage =
      totalEligible > 0
        ? Math.round((prayedIds.size / totalEligible) * 100)
        : 0;

    // Insights
    const notVisited = ujMembers.filter((m) => !visitedIds.has(m.id)).length;
    const notPrayed = ujMembers.filter((m) => !prayedIds.has(m.id)).length;

    return {
      visitCoverage,
      prayerCoverage,
      notVisited,
      notPrayed,
      totalEligible,
    };
  }, [data, isUJTeacher, effectiveChurch, timeRange, selectedYear]);

  // 4. Financial Intelligence
  const financialIntel = useMemo(() => {
    const { start, end } = getDateRange();

    let txns = data.transactions || [];

    // Filter by Church and Date
    txns = txns.filter((t) => {
      const d = new Date(t.date);
      const churchMatch =
        effectiveChurch === "All" ? true : t.churchId === effectiveChurch;
      return d >= start && d <= end && churchMatch;
    });

    let totalIncome = 0;
    let totalExpense = 0;

    // Group by Date for chart
    const groupedByDate = new Map<
      string,
      { date: string; income: number; expense: number }
    >();

    txns.forEach((t) => {
      if (t.type === "INCOME") totalIncome += t.amount;
      else totalExpense += t.amount;

      const dateKey = t.date;
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, {
          date: new Date(t.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          income: 0,
          expense: 0,
        });
      }
      const entry = groupedByDate.get(dateKey)!;
      if (t.type === "INCOME") entry.income += t.amount;
      else entry.expense += t.amount;
    });

    // Sort chronological
    const chartData = Array.from(groupedByDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      chartData,
    };
  }, [data.transactions, effectiveChurch, timeRange, selectedYear]);

  // --- EXPORT LOGIC (Grouped) ---
  const handleExport = (church: Church) => {
    // Get all active people for this church, sorted by name
    const allActive = data.members
      .filter(
        (m) => m.assignedChurch === church && m.status === MemberStatus.ACTIVE,
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    // Separate into Groups
    const members = allActive.filter((m) => m.type === MemberType.MEMBER);
    const fnf = allActive.filter((m) => m.type === MemberType.FNF);

    if (members.length === 0 && fnf.length === 0) {
      alert(`No active members or FNF found for ${church}.`);
      return;
    }

    let text = `*${church} CHURCH MEMBERS LIST*\n\n`;

    if (members.length > 0) {
      text += `*MEMBERS (${members.length})*\n`;
      members.forEach((m, i) => {
        text += `${i + 1}. ${m.name}\n`;
      });
      text += `\n`;
    }

    if (fnf.length > 0) {
      text += `*FNF (${fnf.length})*\n`;
      fnf.forEach((m, i) => {
        text += `${i + 1}. ${m.name}\n`;
      });
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4">
      {/* TOP BAR: Controls */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">
            Analytics Hub
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Deep dive into data & trends.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
          {/* Church Filter (Management Only) */}
          {hasManagementView && (
            <div className="relative">
              <select
                className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={adminFilterChurch}
                onChange={(e) =>
                  setAdminFilterChurch(e.target.value as Church | "All")
                }
              >
                <option value="All">All Churches</option>
                {availableChurches.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}

          {/* Year Selector */}
          <div className="relative">
            <select
              className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {getAvailableYears().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Calendar
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* Period Selector */}
          <div className="bg-slate-100 p-1 rounded-xl flex">
            {(["2W", "1M", "3M", "YTD"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${timeRange === range ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION A: ATTENDANCE INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="space-y-4 lg:col-span-1">
          <motion.div
            key={`avg-${stats.avg}`}
            initial={{ opacity: 0.8, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase">
                Avg Attendance
              </span>
            </div>
            <div className="flex items-end gap-3">
              <motion.span
                key={`avg-val-${stats.avg}`}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-4xl font-extrabold text-slate-800"
              >
                {stats.avg}
              </motion.span>
              {stats.growth !== 0 && (
                <motion.div
                  key={`growth-${stats.growth}`}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`flex items-center text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${stats.growth > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {stats.growth > 0 ? (
                    <TrendingUp size={12} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} className="mr-1" />
                  )}
                  {Math.abs(stats.growth)}%
                </motion.div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">
              vs previous period
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div
              key={`retention-${stats.retention}`}
              initial={{ opacity: 0.8, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"
            >
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                Retention
              </div>
              <motion.div
                key={`retention-val-${stats.retention}`}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-slate-800"
              >
                {stats.retention}%
              </motion.div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.retention}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-purple-500 h-full rounded-full"
                />
              </div>
            </motion.div>
            <motion.div
              key={`newfaces-${stats.newFaces}`}
              initial={{ opacity: 0.8, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100"
            >
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                New Faces
              </div>
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-1">
                <motion.span
                  key={`newfaces-val-${stats.newFaces}`}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  +{stats.newFaces}
                </motion.span>
                <span className="text-xs text-slate-400 font-normal">/wk</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Avg FNF attendees
              </p>
            </motion.div>
          </div>

          {/* AI Insight Card */}
          <div className="bg-indigo-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl -translate-y-4 translate-x-4"></div>
            <div>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-300" /> AI Insight
                </h4>
                <button
                  onClick={generateInsight}
                  disabled={isGenerating}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={12}
                    className={isGenerating ? "animate-spin" : ""}
                  />
                </button>
              </div>
              {isGenerating ? (
                <div className="flex items-center gap-2 text-indigo-300 text-xs py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Analyzing trends...</span>
                </div>
              ) : (
                <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                  {aiInsight || "Select a range to analyze."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Attendance Breakdown</h3>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wide">
              <div className="flex items-center gap-1 text-indigo-600">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>{" "}
                Member
              </div>
              <div className="flex items-center gap-1 text-amber-600">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div> FNF
              </div>
              <div className="flex items-center gap-1 text-rose-600">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div> Other
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[250px] overflow-x-auto scrollbar-hide">
            <div className="min-w-[600px] h-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length > 0) {
                        const payload = e.activePayload[0].payload;
                        setSelectedChartDate({
                          date: payload.date,
                          presentIds: payload.presentIds,
                        });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <defs>
                      <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFnf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                      cursor={{
                        stroke: "#cbd5e1",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Member"
                      stackId="1"
                      stroke="#6366f1"
                      fill="url(#colorMem)"
                    />
                    <Area
                      type="monotone"
                      dataKey="FNF"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="url(#colorFnf)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Inconsistent"
                      stackId="1"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm font-medium text-slate-400">
                  No attendance records found for this period.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Heatmap */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col">
          <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h3 className="font-bold text-slate-800">Participation Heatmap</h3>
            <div className="text-xs text-slate-400">
              Events and participation density for the selected year
            </div>
          </div>
          <div className="w-full relative mt-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <AttendanceHeatmap
              year={selectedYear}
              attendance={data.attendance}
              effectiveChurch={effectiveChurch}
            />
          </div>
        </div>

        {hasManagementView && managementOverview && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col overflow-hidden">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                Management Overview: Service Breakdown
              </h3>
              <div className="text-xs text-slate-400">
                Total Kids Aggregated over Period
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 font-bold text-xs text-slate-500 uppercase">
                      Church/Branch
                    </th>
                    <th className="px-4 py-3 font-bold text-xs text-slate-500 uppercase text-center">
                      Total Attendance
                    </th>
                    <th className="px-4 py-3 font-bold text-xs text-slate-500 uppercase">
                      Enlargement Service
                    </th>
                    <th className="px-4 py-3 font-bold text-xs text-slate-500 uppercase">
                      Joy Service
                    </th>
                    <th className="px-4 py-3 font-bold text-xs text-slate-500 uppercase">
                      Special Service
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(managementOverview || {}).map(
                    ([churchId, stats]: [string, any]) => (
                      <tr
                        key={churchId}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span className="font-bold text-slate-700">
                            {churchId}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-extrabold text-indigo-600">
                            {stats.totalKids}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-slate-600 font-medium">
                              {stats.services["ENLARGEMENT"]?.kidsCount || 0}{" "}
                              Kids
                            </span>
                            <span className="text-indigo-600 font-bold">
                              {stats.services["ENLARGEMENT"]?.teachersCount ||
                                0}{" "}
                              Teachers
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-slate-600 font-medium">
                              {stats.services["JOY"]?.kidsCount || 0} Kids
                            </span>
                            <span className="text-indigo-600 font-bold">
                              {stats.services["JOY"]?.teachersCount || 0}{" "}
                              Teachers
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-slate-600 font-medium">
                              {stats.services["SPECIAL"]?.kidsCount || 0} Kids
                            </span>
                            <span className="text-indigo-600 font-bold">
                              {stats.services["SPECIAL"]?.teachersCount || 0}{" "}
                              Teachers
                            </span>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Demographics D3 Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Age Demographics</h3>
          </div>
          <div className="flex-1 min-h-[250px]">
            <DemographicsChart
              members={data.members}
              effectiveChurch={effectiveChurch}
            />
          </div>
        </div>
      </div>

      {/* SECTION B: OUTREACH INTELLIGENCE (UJ Only) */}
      {outreachIntel && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 px-1">
            <HeartHandshake size={20} className="text-indigo-600" /> Outreach
            Intelligence
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visits Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h4 className="font-bold text-slate-700">
                    Visitation Coverage
                  </h4>
                  <p className="text-xs text-slate-400">
                    Unique kids visited in period
                  </p>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <MapPin size={20} />
                </div>
              </div>

              <div className="flex items-end gap-2 relative z-10">
                <span className="text-4xl font-extrabold text-slate-800">
                  {outreachIntel.visitCoverage}%
                </span>
                <span className="text-sm text-slate-400 mb-1.5 font-medium">
                  of {outreachIntel.totalEligible} kids
                </span>
              </div>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 relative z-10">
                <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg">
                  <Target size={14} />
                </div>
                <p className="text-xs text-slate-600">
                  <b>{outreachIntel.notVisited} children</b> have not been
                  visited in this period.
                </p>
              </div>

              {/* Background Decor */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-50 rounded-full opacity-50 pointer-events-none"></div>
            </div>

            {/* Prayer Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h4 className="font-bold text-slate-700">Prayer Coverage</h4>
                  <p className="text-xs text-slate-400">
                    Unique kids prayed for in period
                  </p>
                </div>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Heart size={20} />
                </div>
              </div>

              <div className="flex items-end gap-2 relative z-10">
                <span className="text-4xl font-extrabold text-slate-800">
                  {outreachIntel.prayerCoverage}%
                </span>
                <span className="text-sm text-slate-400 mb-1.5 font-medium">
                  of {outreachIntel.totalEligible} kids
                </span>
              </div>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 relative z-10">
                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
                  <Target size={14} />
                </div>
                <p className="text-xs text-slate-600">
                  <b>{outreachIntel.notPrayed} children</b> pending prayer
                  coverage.
                </p>
              </div>

              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-50 rounded-full opacity-50 pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: FINANCIAL INTELLIGENCE */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 px-1">
          <Wallet size={20} className="text-emerald-600" /> Financial
          Intelligence
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-1">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <TrendingUp size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Total Income
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-800">
                GH₵ {financialIntel.totalIncome.toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <TrendingDown size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Total Expense
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-800">
                GH₵ {financialIntel.totalExpense.toLocaleString()}
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 text-white rounded-xl">
                  <Wallet size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Net Balance
                </span>
              </div>
              <div className="text-3xl font-extrabold">
                GH₵ {financialIntel.balance.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Financial Trend</h3>
            </div>
            <div className="flex-1 min-h-[250px] overflow-x-auto scrollbar-hide">
              {financialIntel.chartData.length > 0 ? (
                <div className="min-w-[500px] h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={financialIntel.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                        cursor={{ fill: "#f8fafc" }}
                      />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                      <Bar
                        dataKey="expense"
                        name="Expense"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No financial data for this period
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: MEMBER EXPORT */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <MessageCircle size={20} className="text-green-600" /> WhatsApp
              Export
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Export active member lists directly to WhatsApp.
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableChurches.map((church) => (
              <button
                key={church}
                onClick={() => handleExport(church)}
                className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-200 rounded-2xl transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm mb-2 group-hover:scale-110 transition-transform
                                ${church === "UJ" ? "bg-indigo-500" : church === "I" ? "bg-emerald-500" : church === "K" ? "bg-rose-500" : "bg-amber-500"}
                            `}
                >
                  {church.substring(0, 2)}
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-green-700">
                  Export {church}
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-green-600 flex items-center gap-1 mt-1">
                  <Share2 size={10} /> Share List
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => handleExport(activeChurch)}
            className="w-full py-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-green-100 transition-all shadow-sm active:scale-[0.99]"
          >
            <Share2 size={20} />
            <span>Export {activeChurch} Members List</span>
          </button>
        )}
      </div>

      {/* DETAILS MODAL */}
      {selectedChartDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-3xl text-slate-800">
              <div>
                <h3 className="font-bold">
                  Attendees on {selectedChartDate.date}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedChartDate.presentIds.length} present (including
                  teachers)
                </p>
              </div>
              <button
                onClick={() => setSelectedChartDate(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <div className="space-y-2">
                {(() => {
                  // Maps ids to member names and sort alphabetically
                  const membersPresent = selectedChartDate.presentIds
                    .map((id) => data.members.find((m) => m.id === id))
                    .filter((m) => !!m)
                    .sort((a, b) => a!.name.localeCompare(b!.name));

                  if (membersPresent.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400">
                        No attendees found.
                      </div>
                    );
                  }

                  return membersPresent.map((m) => (
                    <div
                      key={m!.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                        <User size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-700">
                          {m!.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {m!.type}
                          </span>
                          {m!.assignedChurch !== effectiveChurch && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-600 uppercase border border-indigo-100">
                              {m!.assignedChurch}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsHub;
