/**
 * Centralized Application Versioning & Release Log
 * Follows Semantic Versioning (SemVer: MAJOR.MINOR.PATCH)
 *
 * Rules for Version Increments:
 * - MAJOR: Breaking architectural shifts, database restructuring, or fundamental workflows.
 * - MINOR: New feature modules (e.g. Photo Studio, Branch Cascade, Notification Engine).
 * - PATCH: Bug fixes, UI adjustments, text-wrapping improvements, performance tuning.
 */

export interface ReleaseLog {
  version: string;
  date: string;
  title: string;
  badge?: string;
  changes: string[];
}

export const APP_VERSION = "1.7.10";
export const APP_RELEASE_NAME = "Instant DB Auto-Save, Live Shepherd Badges & Multi-Component Sync";
export const APP_BUILD_DATE = "2026-09-29";

export const CHANGELOG: ReleaseLog[] = [
  {
    version: "1.7.10",
    date: "2026-09-29",
    title: "Instant DB Auto-Save, Live Shepherd Badges & Multi-Component Sync",
    badge: "Current Release",
    changes: [
      "Instant DB Auto-Save: All shepherd allocation movements, bulk transfers, auto-allocations, and custom family overrides immediately persist to Cloud Firestore and localStorage without requiring a manual save button click",
      "Live Cloud DB Status: Added real-time animated saving status ('Saving to Database...') and timestamped confirmation badges ('Auto-Saved & Live HH:MM:SS') with an on-demand 'Sync Now' action in Shepherd Allocation Manager",
      "Immediate Multi-Component Sync: Allocation modifications immediately propagate across the app, reflecting synchronously in Attendance Taker, People Hub (Members Directory), and Report Export",
      "Assigned Shepherd Badges in Attendance Taker: Displayed assigned shepherd badges on child attendance cards with direct visual indicators for assigned and unassigned children",
      "Shepherd Attendance Filter: Added a dedicated Shepherd Filter selector in Attendance Taker so shepherds and coordinators can filter rosters directly to their assigned children",
      "People Hub Shepherd Integration: Added assigned shepherd badges to both desktop table rows and mobile member cards, and added an 'Assigned Shepherd' selector inside the Member Edit Drawer",
      "Ghost-Free Allocation Sync: Hardened setHookedTeacherId and storageService to cleanly remove localStorage allocation keys when unassigning, eliminating ghost overrides across devices",
    ],
  },
  {
    version: "1.7.9",
    date: "2026-09-29",
    title: "Family & Household Decision Overrides in Shepherd Allocation",
    badge: "Previous Release",
    changes: [
      "Custom Family Decision Controls: Empowered users to explicitly decide whether children sharing surnames/phones are a family or independent individuals within Shepherd Allocation",
      "One-Click 'Not a Family' Separation: Separate coincidentally named children into independent records with 1-click, preventing unwanted household auto-grouping or transfers",
      "Cross-Surname Family Linking: Easily link siblings, cousins, or guardians with different surnames into a shared household unit with optional custom family names",
      "Interactive Family Decision Modal: Added intuitive family management modal accessible directly from child cards across Grid View, Side-by-Side Mode, and Unassigned Tray",
      "In-Transfer Separation Shortcut: Added direct 'Not in this family? Separate Child' action right inside the Transfer Modal for fast allocation workflow without leaving the dialog",
      "Multi-Campus Transfer: Support transferring members between different campus branches with automatic zone resolution in People Hub",
      "Full Persistence: Custom family choices (`householdId` & `householdName`) persist seamlessly to localStorage and Firestore and automatically influence auto-allocation and reports",
    ],
  },
  {
    version: "1.7.8",
    date: "2026-09-29",
    title: "Shepherd Allocations Manager, Instant Archiving & Shepherd Nomenclature",
    badge: "Previous Release",
    changes: [
      "Shepherd Nomenclature: Systematically replaced all user-facing references to 'Teachers' and 'Staff' with 'Shepherds' across Attendance Taker and People Hub",
      "Instant 0ms Archiving: Optimized single member archive and bulk archive actions to immediately dismiss confirmation dialogs and update local UI cache with zero delay while completing Firestore cloud sync in the background",
      "Interactive Shepherd Allocation Manager in Settings: Built a dedicated configuration view to visualize, organize, and reassign children to their shepherds per church department (UJ, LJ, K, I)",
      "Automatic & Manual Capacity Balancing: Added one-click 'Auto-Allocate & Equalize' ensuring balanced child quotas per shepherd while preserving household and sibling units",
      "Household-Aware Reorganization: Enabled moving individual children or entire family household units together between shepherds in a single click, with real-time capacity and quota indicators",
      "Unassigned Children Tray: Added a responsive unassigned tray with instant 1-click assignment and automatic even distribution among least-loaded shepherds",
    ],
  },
  {
    version: "1.7.7",
    date: "2026-09-28",
    title: "Attendance Day Intelligence, Household Shepherd Division, Persistent First Timers & Sunday Dashboard Pending State",
    changes: [
      "First Timers Persistence & Cross-Component Sync: Fixed multi-entry first timers saving in Attendance Taker by assigning valid church departments, flushing immediately to Firestore, and broadcasting cross-component dataUpdated events to eliminate data loss upon logout or refresh",
      "Attendance Day Intelligence: Replaced manual Sunday/LC Live switcher with backend day intelligence where Wednesdays are exclusively LC Live for shepherds (staff mode), Sundays support the 3 Sunday services (Joy, Enlargement, Special), and other days dynamically open for Special Services",
      "Dynamic Special Service Reusability: When saving attendance on non-Sunday/non-Wednesday dates, the app automatically reuses any existing event name already recorded for that date, asking for an event name only when none exists yet",
      "Static Header Controls & Floating Save: Positioned attendance header and save controls statically with names flowing underneath, accompanied by a floating quick-save button so users never need to scroll back up through long rosters",
      "Report Export Children Breakdown: Under 'TOTAL PRESENT', replaced individual service name listings with 'Children: X' alongside shepherds for clear, clean individual shepherd reports",
      "Sunday Dashboard Pending State: When it is Sunday and attendance has not yet been recorded, 'This Sunday' members and shepherds counts display 0 with a 'Pending' badge instead of falling back to the previous Sunday's numbers",
      "Equal Household Shepherd Division: Upgraded teacher division algorithm to cluster children with identical surnames (Mensah, Zong, Opoku, etc.), parent phones, and linked siblings (Sandra Omari & Kelvin Asante, Esther & Maeeva) under the same shepherd while strictly balancing total counts equally across all shepherds",
    ],
  },
  {
    version: "1.7.6",
    date: "2026-09-26",
    title: "Branch Coordinator Church Attendance Filtering, Global Children Terminology & Mobile UX Optimization",
    changes: [
      "Added church branch filtering for Branch Coordinators and Leadership in Attendance Taker: enabled department dropdown and quick-tap church pills (All, UJ, LJ, K, I) for effortless church scoping and name searching",
      "Unified nomenclature to 'Child' and 'Children': systematically replaced all user-facing instances of 'kid' and 'kids' across Dashboard, Outreach Intelligence, Analytics tables, and service summaries",
      "Optimized mobile screens and responsiveness in Attendance Taker: made the Members vs Shepherds mode toggle directly accessible on all screen sizes, removed mobile layout cramping, and prevented viewport clipping",
      "Enhanced mobile card layout in Members Directory: provided full width for child avatar, details, birthdate, and promotion bars, placing action buttons in a clean, dedicated bottom bar to eliminate squished cards",
      "Improved mobile navigation in Reports & Export: made tab titles fully legible and responsive with swipeable scroll, ensuring seamless access to WhatsApp and data management tools",
    ],
  },
  {
    version: "1.7.5",
    date: "2026-09-26",
    title: "Attendance First Timers Persistence, Seamless Save, LC Live & Inter-Church Member Transfers",
    changes: [
      "Fixed adding and saving First Timers during attendance: resolved state timing race by passing newly created first timers directly into confirmSave and awaiting storage write before onUpdate refresh",
      "Fixed target church assignment for First Timers so they automatically attach to the active church branch currently taking attendance instead of falling back incorrectly",
      "Enhanced attendance Save button: eliminated turning/spinning disk icon, creating a smooth, responsive, and seamless saving experience with instant visual confirmation",
      "Replaced Cell with LC Live across Attendance Taker: restricted LC Live exclusively to Wednesday, while allowing Joy, Enlargement, and Special services on all days of the week",
      "Fixed member and children transfers between church branches: removed unidirectional transfer restrictions to allow moving any member or child between any church branch (UJ, LJ, K, I, and Archive)",
      "Guaranteed atomic member updates on transfer and edit by strictly synchronizing churchId and assignedChurch and awaiting remote completion before refreshing list state",
    ],
  },
  {
    version: "1.7.4",
    date: "2026-09-25",
    title: "Shepherd Nomenclature Migration & Unified Prayer Accounting Synchronization",
    changes: [
      "Migrated user-facing nomenclature from 'Teachers' to 'Shepherds' across Dashboard, Attendance rosters, Member lists, Report Exports, Settings, and Outreach Hub",
      "Unified prayer time accounting across Dashboard, Prayer Wall banner, and TRACK tab, ensuring annual targets and intercession hours tally seamlessly",
      "Fixed YTD current-year filtering on OutreachHub prayer stats and aligned session duration accounting with actual scheduled slot minutes",
      "Refined Shepherd personal views in the TRACK tab to properly scope assigned children and intercessory prayer sessions to their roster",
      "Preserved full backwards compatibility with Firestore schemas and security rules by maintaining internal Role/MemberType constants while presenting Shepherd across all UI layers",
    ],
  },
  {
    version: "1.7.3",
    date: "2026-09-25",
    title: "OutreachHub Immediate Prayer Persistence & Achievement Metrics Accounting",
    changes: [
      "Fixed prayer completion persistence so marking and unmarking slots immediately write to Firestore (appData/main) and localStorage without relying on floating batch save buttons",
      "Resolved un-awaited debounced update race conditions in storageService: savePrayerSlot, savePrayerSlots, and saveOutreachSessions now strictly await remote Firestore completion",
      "Added atomic savePrayerSlots and saveOutreachSessions batch methods to prevent race conditions during bulk updates",
      "Fixed Branch Coordinator role classification in filteredLocalPrayerSlots preventing branch coordinators from having prayer slots hidden",
      "Added live Prayer Achievement & Accounting cards on Prayer Wall banner (Sessions Done, Time Interceded, Children Covered, Pending This Week)",
      "Added Prayer & Intercession Progress tracking card to the TRACK tab alongside Visits and Calls progress for comprehensive yearly outreach accounting",
      "Hardened defensive guards on (s.assignedMemberIds || []) across getMemberStats, PrayerSlotCard, and prayer schedule filters preventing undefined runtime exceptions",
    ],
  },
  {
    version: "1.7.2",
    date: "2026-09-24",
    title: "Instant Portrait Saving & Non-Blocking Cloud Synchronization",
    changes: [
      "Eliminated the unending save wait on portrait customization by decoupling UI modal closure from remote network upload tasks",
      "Optimistically applies the optimized 256x256 WebP portrait to member form state in 0ms, closing the Photo Studio modal immediately",
      "Protected cloud storage and fallback persistence with strict 2.5s timeout races, preventing SDK exponential backoff hangs on unprovisioned buckets",
      "Immediate persistence for existing member record updates and automatic background synchronization to Firestore",
    ],
  },
  {
    version: "1.7.1",
    date: "2026-09-24",
    title: "Dedicated Web Worker AI Processing & Zero-Freeze Studio UI",
    changes: [
      "Offloaded @imgly/background-removal neural processing into a dedicated Web Worker (src/workers/cutoutWorker.ts), guaranteeing 0% AI CPU load on the browser UI thread",
      "Eliminated all interface freezes, stutter, and main-thread blocking during subject isolation, maintaining steady 60 FPS across panning, zooming, and color picking",
      "Configured Vite worker code-splitting (worker: { format: 'es' }) for high-performance ES module worker compilation",
      "Sub-3ms interim algorithmic cutout with deferred frame yielding preventing any interaction delay during image selection",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-09-24",
    title: "AI Neural Background Removal, Studio Depth & Zero-Lag Previews",
    changes: [
      "Dual-engine subject isolation combining dynamic in-browser AI neural background removal (@imgly/background-removal) with an instant ~15ms algorithmic fallback",
      "Subject visual depth enhancement: added 3D Studio Drop Shadow and Silhouette Edge Pop rim lighting to make the subject physically stand out from any chosen backdrop",
      "Zero-lag cached cutout architecture eliminating main-thread pixel re-computation during panning, zooming, rotation, and backdrop switching",
      "Instant live real-world previews for Card View (80px) and Roster Badge (40px) updated in real-time on the exact same frame",
      "New vibrant studio presets: Velvet Purple and Sunset Crimson added to the permanent studio collection",
      "Real-time background processing status indicators (AI Isolating, AI Studio Cutout, Smart Cutout Active) and quick Re-isolate button",
      "Enhanced Wednesday cell and mid-week attendance saving and report template preservation for Branch Coordinators",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-23",
    title: "Consolidated Reports, Dual Camera & Subject Background Removal",
    changes: [
      "Permanent resolution of Branch Coordinator & Admin 'All / CM Church' report generation with multi-department consolidation across UJ, LJ, K, I, and N",
      "Corrected Branch Coordinator role evaluation preventing teacher profile classifications from suppressing the Mega Center reporting template",
      "Dual mobile phone camera integration with front/rear switching and native OS camera capture fallbacks",
      "Intelligent client-side portrait background removal (subject cutout) isolating child from room backgrounds",
      "Custom backdrop image upload and custom solid color picker with live preview and hex entry",
      "Removed generic sparkles across the entire application and introduced extensible AppLogoSlot brand architecture",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-09-23",
    title: "Children's Photo Studio & Constant Studio Backgrounds",
    changes: [
      "In-browser Photo Studio with live webcam capture and drag-and-drop file upload",
      "Preset constant studio backgrounds (Church Indigo, Royal Blue, Warm Amber, Studio Slate, Fresh Emerald, Clean Light)",
      "Automatic circular framing, interactive pan/zoom (0.8x - 2.5x), and studio edge feathering",
      "Optimized 256x256 WebP compression (<25KB) with Firebase Cloud Storage upload and resilient Firestore collection fallback",
      "Reusable MemberAvatar with deterministic initials badges in the member directory, drawer, and attendance rosters",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-23",
    title: "Thesaurus Auto-Attachment & Cascade Branch Renaming",
    changes: [
      "Automatic migration attaching all historical and new Thesaurus HQ data to Thesaurus across all tables",
      "Atomic branch rename cascade across members, attendance, finances, outreach, prayers, notifications, and sessions",
      "Context-aware activity notification engine filtered by role (Super Admin, Zonal Head, Coordinator, Teacher)",
      "Seamless multi-line text wrapping in Settings across zones and permission matrix without ellipsis dots",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09-20",
    title: "Granular Permission Matrix & Multi-tenant Organization",
    changes: [
      "Role-based feature and subfeature access control matrix across all leadership tiers",
      "Zonal and Branch structural hierarchy management with instant reassignments",
      "Multi-tenant data scoping for zones and branch coordinators",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-15",
    title: "Attendance Taker with Punctuality & Dual-Service",
    changes: [
      "Punctuality tracking with 30-child capacity thresholds",
      "Joy Service and Service 2 dual-service attendance logging",
      "Bulk attendance check-in and search filtering",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-01",
    title: "Initial Children's Ministry Directorate Release",
    changes: [
      "Core member management, attendance logging, and basic dashboard metrics",
      "Cloud Firestore real-time synchronization with 0ms local storage caching",
    ],
  },
];
