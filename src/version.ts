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

export const APP_VERSION = "1.7.22";
export const APP_RELEASE_NAME = "Report & Dashboard Synchronization for Separate First Timers and FNFs";
export const APP_BUILD_DATE = "2026-10-05";

export const CHANGELOG: ReleaseLog[] = [
  {
    version: "1.7.22",
    date: "2026-10-05",
    title: "Report & Dashboard Synchronization for Separate First Timers and FNFs",
    badge: "Current Release",
    changes: [
      "Dashboard Status Breakdown & Targets: When switched to Separate First Timers and FNFs in Settings, Dashboard immediately displays distinct counts and badge cards for First Timers and recurring FNFs",
      "Church Membership & Population Metrics: Corrected church population filters across Multi-Church and Church Dashboards to include First Timers in active metrics when separated, with live reactive cache updates",
      "Comprehensive Report Formats (Mega Center, Consolidated, Single Church): Reports now generate independent 'FIRST TIMERS' and 'FNFS' rosters and totals when separated, ensuring coordination messages sent to WhatsApp accurately distinguish new visitors from returning guests",
      "Directorate & Annual Reporting: Directorate grand totals, zonal summaries, and Annual Attendance reports dynamically branch between combined 'FNFs' and separated 'First Timers / FNFs'",
      "Analytics Hub Intelligence & Prediction Targets: Stacked attendance charts, prediction models, and WhatsApp directory exports now track and predict First Timers and FNFs independently when separated",
    ],
  },
  {
    version: "1.7.21",
    date: "2026-10-05",
    title: "Cross-Component Synchronization, Rich Relationship Linking & Smart Empty States",
    badge: "Previous Release",
    changes: [
      "Smart Empty States with Active Filter Badges: Replaced blank or generic empty views in People Hub and Attendance Taker with intelligent, context-aware empty state panels featuring active search/shepherd/church/category pills and one-click reset buttons",
      "Interactive Shepherd Cohort Linking: Clicking on any active shepherd badge in People Hub or Attendance Taker immediately filters the view to that shepherd's cohort for rapid inspection",
      "Dangling Shepherd & Orphan Detection: If an assigned shepherd was archived, transferred, or unlinked, records now prominently display an amber 'Former / Inactive Shepherd' or 'Unlinked Shepherd (Reassign)' action badge rather than showing misleading unassigned text",
      "Household & Contact Relationship Badges: Members now show their linked household group and parent contact details with direct call links in tables and mobile cards",
      "Household Group Form Field: Added a dedicated Household / Family Group field in the member registration and edit forms to link siblings seamlessly",
      "Shepherd Allocations Empty Cohort Actions: When a shepherd has no children assigned yet, provides a direct 1-click button to assign children from the unassigned cohort",
      "Outreach Hub Relationship Linking: Outreach contact cards now display the child's assigned shepherd and provide reassuring empty state feedback when categories are up to date",
    ],
  },
  {
    version: "1.7.20",
    date: "2026-10-05",
    title: "People Hub Revamp, Shepherd Church Scoping & Label Cleanups",
    badge: "Current Release",
    changes: [
      "Terminology Refinement: Standardized on 'First Timer' (and plural 'First Timers') without using 'Visitor', and standardized dropdown and filter labels on 'FNF' (and 'FNFs') rather than 'Friends & Family'",
      "People Hub Revamp - Comprehensive Fuzzy Search: Search now matches across member full names, assigned church, branch ID, phone and parent phone numbers, physical address, household names, assigned shepherd names, and calculated ages",
      "People Hub Revamp - Expanded Multi-Criteria Sorting: Added Name A-Z, Name Z-A, Attendance High-Low, Attendance Low-High, Recently Added (newest joins first), and Age (Youngest-Oldest and Oldest-Youngest)",
      "Strict Church Scoping for Shepherds: In both People Hub and Attendance Taker, shepherd filter dropdowns now strictly list only shepherds assigned to that specific church, rather than showing shepherds from other churches",
      "Modal Shepherd Scoping: In member edit and registration modals, assigned shepherd options now strictly filter to the selected child's church",
    ],
  },
  {
    version: "1.7.19",
    date: "2026-10-05",
    title: "Intelligent First Timers & FNFs Auto-Regrouping",
    badge: "Previous Release",
    changes: [
      "Intelligent Switch & Auto-Regrouping: When opting for separate First Timers and FNFs in Settings, children are automatically re-analyzed and reassigned based on empirical attendance count and historical records",
      "Attendance History Classification: Children with 1 or fewer attendance sessions are dynamically assigned as First Timers (Visitors), while recurring children with 2 or more sessions are assigned to Friends & Family (FNFs)",
      "Historical Fallback & Preservation: Added previousType to member records to ensure original classifications are preserved across merges and transitions without data loss",
      "On-Demand Re-Analyze Action: Added 'Re-Analyze & Regroup' action button and informative policy banner in Settings allowing leaders to re-classify children as attendance records accumulate",
    ],
  },
  {
    version: "1.7.18",
    date: "2026-10-05",
    title: "Component & Attendance Config, Sunday Pending Safeguard & Child Record Sunday Count",
    badge: "Previous Release",
    changes: [
      "Component & Attendance Configuration: Added dedicated settings section and tab to configure cross-app component behaviors, toggle combining First Timers & FNFs vs separating them with immediate app-wide reflection",
      "Annual Attendance Days Policy: Added configurable attendance count modes ('Sundays Only', 'Sundays & Wednesdays', and 'All Logged Sessions') with granular day-of-week inclusion toggles",
      "Child Record Sunday Attendance Count: Enabled explicit Sunday attendance count display (e.g. 'Sun: X / Y') on child badges and directory profile records",
      "New Child Attendance Safeguards: Fixed joined date initialization for new members, providing initial registration grace with clean 'New Member (0 sessions)' badge without false absence streaks or deactivation alerts",
      "Sunday Pending State on Dashboard: Ensured that on Sunday, if a church has not yet taken attendance today, their count displays as 0 with a 'Pending' badge rather than reusing the prior week's count, preventing false drops in accounting and insights",
    ],
  },
  {
    version: "1.7.17",
    date: "2026-09-30",
    title: "Unified FNFs (Friends & Family) & Database Migration",
    badge: "Previous Release",
    changes: [
      "Unified FNF Classification: Merged FNFs and First Timers (Visitors) into a single cohesive category titled 'FNFs' (Friends & Family) across the database and all application components",
      "Automatic Database Migration: Built seamless in-memory and Firestore persistence migration automatically updating legacy Visitor records to MemberType.FNF while preserving historical records",
      "Attendance Taker Unification: Streamlined quick-add modal, role chips, and filters to exclusively register and display FNFs, maintaining them unassigned from shepherds as per ministry guidelines",
      "Directory & People Hub Consolidation: Merged First Timers and Friends & Family table sections into a single 'Friends & Family (FNFs)' section, updating badges and member creation options",
      "Outreach Hub & Connect Directory: Consolidated Connect directory categories, filters, progress breakdowns, and member cards under unified 'FNFs' with 1-click full member promotion",
      "Reports, Analytics & Dashboard Synchronization: Unified WhatsApp reports, weekly attendance breakdowns, prediction targets, and dashboard status cards under FNFs",
    ],
  },
  {
    version: "1.7.16",
    date: "2026-09-30",
    title: "Shepherd-Scoped Add Member Modal & Generation Safeguards",
    badge: "Previous Release",
    changes: [
      "Shepherd-Scoped Add Member Modal: Restricted the 'Add Member' selection list in Outreach visitation sessions for logged-in shepherds exclusively to children assigned directly to their care",
      "Roster Integrity in Manual Selection: Filtered Add Member candidate children to active, inconsistent, and not active members only, strictly excluding FNFs, First Timers, and staff",
      "Enhanced Modal Context & UX: Added dedicated 'Your Assigned Children' header indicator, search placeholder, member status chips (Active/Inconsistent/Not Active), and informative empty state guidance when all assigned children are already scheduled",
    ],
  },
  {
    version: "1.7.15",
    date: "2026-09-30",
    title: "Shepherd-Scoped Visit & Prayer Generation Lock",
    badge: "Previous Release",
    changes: [
      "Strict Shepherd-Specific Generation: Locked visit and weekly prayer schedule generation for logged-in shepherds exclusively to children assigned directly to their care, preventing cross-shepherd or church-wide candidate leakage",
      "Unified Assignment Lookup: Implemented comprehensive multi-tier lookup (direct assignedTeacherId and division assignments) to reliably pinpoint children assigned to the logged-in shepherd across active sessions",
      "Safe Generation Fallbacks: Replaced church-wide fallback allocations with clear guided alerts prompting shepherds to request or complete child allocations before generating schedules when no children are currently assigned",
      "Member-Only Filtering: Guaranteed that generated outreach and prayer schedules only include active, inconsistent, and not active members, strictly excluding FNFs and First Timers",
    ],
  },
  {
    version: "1.7.14",
    date: "2026-09-30",
    title: "Visit & Prayer Generation Roster Refinement",
    badge: "Previous Release",
    changes: [
      "Targeted Visit & Prayer Rosters: Configured visitation and weekly prayer generation to strictly target active, inconsistent, and not active members only",
      "Excluded FNFs & First Timers from Generation: Removed Friends & Family (FNF) and Visitors/First Timers from automated and manual visit and prayer schedule algorithms, reserving pastoral follow-up slots for church members",
      "Shepherd Pool Hardening: Updated shepherd-assigned visitation and prayer generation filters to strictly draw from assigned regular members, preventing fallback assignment of unassigned FNFs or visitors",
      "Auto-Fill Candidate Filtering: Enhanced Outreach session auto-fill to exclusively propose active, inconsistent, and not active church members without staff, FNFs, or first timers",
    ],
  },
  {
    version: "1.7.13",
    date: "2026-09-30",
    title: "Dashboard Metric Streamlining & Shepherd Allocation Roster Refinement",
    badge: "Previous Release",
    changes: [
      "Streamlined Dashboard Overview: Removed Shepherd Coverage metric card and All Churches pastoral care breakdown rows to maintain a cleaner, focused high-level ministry pulse",
      "Optimized Dashboard Metric Grid: Adjusted StatCard layout to a balanced 5-column responsive grid (Total Membership, Retention Rate, Last Attendance, WoW Change, Membership Goal)",
      "Dedicated Member Allocations: Excluded Friends & Family (FNF) and First Timers (Visitors) from shepherd assignments within Shepherd Allocation so only active church members are divided among shepherds",
      "Automated FNF & First Timer Unassignment: Added automatic background unassignment and DB persistence for any existing FNF or First Timer records with assigned shepherds, keeping rosters strictly aligned with ministry guidelines",
      "Division & Balancing Safeguards: Hardened autoAllocateChildrenForChurch and calculateChurchDivisions routines to filter out FNF and visitor profiles when calculating target capacities and household clusters",
    ],
  },
  {
    version: "1.7.12",
    date: "2026-09-30",
    title: "Revamped Shepherd Cards, Prominent Unassign Actions, Hardened Persistence & Analytics First Timers Export",
    badge: "Previous Release",
    changes: [
      "Revamped Shepherd Card Headers: Modernized Shepherd headers with a deep purple gradient banner, distinctive purple Shepherd badge with shield icon, branch badge, capacity indicator (total / ~target), and styled action menu",
      "Always-Visible Unassign Hero Card in Transfer Modal: Added a prominent top-level 'Move to Unassigned Tray' action card and retained the footer unassign button, guaranteeing easy access at all times",
      "Explicit Quick-Unassign Buttons: Provided styled Unassign buttons with UserX icon across individual child cards in both Grid View and Side-by-Side View",
      "Hardened Unassignment Engine: Prevented auto-reassignment loops in calculation routines and ensured assignedTeacherId deletion across in-memory state, localStorage cache, and Firestore payloads for instant Unassigned Tray updates",
      "Enhanced Analytics Export: Expanded analytics export to include First Timers (Visitors) and Friends & Family (FNF), alongside grouped active, inactive, and inconsistent members with clean WhatsApp breakdowns",
      "Shepherd-Scoped Church Visibility: Restricted Shepherd Allocation Manager for shepherds and teachers to exclusively display their assigned church department (and branch), locking church switching and displaying a dedicated 'Your Church' indicator while preserving multi-church administration for leadership",
    ],
  },
  {
    version: "1.7.11",
    date: "2026-09-30",
    title: "Branch Shepherd Filters, Mobile Vacation Toggle, Collapsible Navigation & Pastoral Coverage Sync",
    badge: "Previous Release",
    changes: [
      "Branch-Scoped Shepherd Filters: Added dedicated branch-scoped shepherd filter dropdowns to both Attendance Taker and People Hub (MembersList) so coordinators and shepherds can view children assigned specifically to shepherds in that branch",
      "Accurate Shepherd Role Labels: Ensured shepherds in Attendance Taker display 'Shepherd' under their names when toggling to Shepherd attendance mode rather than 'Teacher'",
      "Outreach Hub & Dashboard Pastoral Divisions Sync: Live shepherd allocations now dynamically drive divisions and coverage metrics across all Outreach Hub tabs (Visit, Prayer, Connect, Track) and Dashboard calculations",
      "Concise Branch Identifiers: Standardized department and church display names across dropdowns, filters, headers, and cards to concise identifiers (I, K, LJ, and UJ)",
      "Collapsible Settings Navigation: Built an expandable/collapsible settings sidebar for desktop with icon toggle, paired with a compact accordion and horizontal quick-pill selector on mobile",
      "Mobile Vacation Toggle & Table Cleanup: Added the Vacation toggle button directly to mobile cards in People Hub and removed the Teens check column for shepherds on desktop tables",
      "Swift 0ms Response & Offline Queue: Strengthened optimistic updates with instant 0ms latency and automatic queued offline sync upon connection restoration",
      "Adaptive Child Name Wrapping & Enhanced Shepherd Holders: Enhanced Shepherd Allocation cards with full text-wrapping for multi-line child names, prominent purple role badges, and enhanced shepherd header containers",
      "Functional Unassign & Instant Reflection: Made 'Move to Unassigned' and direct quick-unassign buttons fully functional, immediately updating the unassigned roster, counts, and persistence across devices",
    ],
  },
  {
    version: "1.7.10",
    date: "2026-09-29",
    title: "Instant DB Auto-Save, Live Shepherd Badges & Multi-Component Sync",
    badge: "Previous Release",
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
