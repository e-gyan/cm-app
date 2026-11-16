export interface SuiteAppDefinition {
  id: "cm-app" | "watchman" | "save-n-know";
  name: string;
  shortName: string;
  description: string;
  url: string;
  badgeText: string;
  gradientClass: string;
  iconBgClass: string;
  isCurrentApp?: boolean;
}

export const SUITE_APPS: SuiteAppDefinition[] = [
  {
    id: "cm-app",
    name: "Children's Ministry Attendance",
    shortName: "CM Attendance",
    description: "Attendance tracking, shepherd allocations, outreach, prayers, finances & reports.",
    url: "https://cm-app-66u7.onrender.com/",
    badgeText: "Attendance & Care",
    gradientClass: "from-indigo-600 to-violet-600",
    iconBgClass: "bg-indigo-600 text-white",
    isCurrentApp: true,
  },
  {
    id: "watchman",
    name: "Watchman",
    shortName: "Watchman",
    description: "Partner Prayer & Testimony Tracker.",
    url: "https://watchmen-app.onrender.com/",
    badgeText: "Prayer & Testimony",
    gradientClass: "from-sky-600 to-blue-700",
    iconBgClass: "bg-sky-600 text-white",
  },
  {
    id: "save-n-know",
    name: "Save N Know",
    shortName: "Save N Know",
    description: "Discipleship, knowledge & tracking companion.",
    url: "https://savenknow.onrender.com/",
    badgeText: "Discipleship",
    gradientClass: "from-emerald-600 to-teal-700",
    iconBgClass: "bg-emerald-600 text-white",
  },
];
