# Children's Ministry Directorate (CMD) Platform

[![Version](https://img.shields.io/badge/version-1.7.10-indigo.svg)](src/version.ts)
[![Release](https://img.shields.io/badge/release-Instant%20DB%20Auto--Save%20%26%20Multi--Component%20Sync-emerald.svg)](src/version.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](package.json)

A modern, cloud-synchronized multi-tenant application for Children's Ministry attendance tracking, child photo studio management, children outreach, financial ledger accounting, granular role-based permissions, and automated WhatsApp reporting.

---

## Version Control and Release Protocol

The platform follows **Semantic Versioning (SemVer: `MAJOR.MINOR.PATCH`)**:

```
v1.7.7
 ┬ ┬ ┬
 │ │ └─ PATCH: Bug fixes, UI adjustments, text-wrapping tweaks, performance improvements.
 │ └─── MINOR: New functional modules.
 └───── MAJOR: Breaking architectural shifts, database restructure, or fundamental workflow redesigns.
```

### Where Version Information is Surfaced
1. **Central Definition**: [src/version.ts](src/version.ts) maintains `APP_VERSION`, `APP_RELEASE_NAME`, `APP_BUILD_DATE`, and a full interactive `CHANGELOG`.
2. **Login Interface**:
   - Desktop sidebar: Shows current version with a direct **What's New** modal trigger.
   - Mobile card: Shows a subtle version pill linking to the interactive release notes.
3. **Application Navigation**:
   - Desktop sidebar footer: Interactive version badge with sparkle icon opening the **Release Notes / Changelog Modal**.
   - Mobile header: Displays `v{APP_VERSION}` dynamically alongside church scope.
   - **Settings and Config**: Displays platform version, release name, and a **View Release Notes** button.

### How to Increment the Version
When introducing changes:
1. Update `APP_VERSION`, `APP_RELEASE_NAME`, and `APP_BUILD_DATE` in [`src/version.ts`](src/version.ts).
2. Append a new release entry to the `CHANGELOG` array in [`src/version.ts`](src/version.ts).
3. Update `"version"` in [`package.json`](package.json).
4. Run `npm run lint` and `npm run build` to verify clean compilation.

---

## Architecture and Technology Stack

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS, Lucide React icons, Recharts, Motion.
- **Backend and Serving**: Node.js & Express 5 (bootstrap in `server.ts`), Vite 6 bundler, esbuild.
- **Cloud Database**: Cloud Firestore (`appData/main` root document with synchronous 0ms `localStorage` caching via `getInstantData()`, offline drafts, and real-time `onSnapshot` listeners).
- **Media and Avatar Storage**: Firebase Cloud Storage (`members/photos/{id}.webp`) with an isolated Firestore fallback collection (`memberPhotos/{id}`) guaranteeing the 1 MB main document limit is never exceeded.
- **AI Background Removal**: Client-side AI Neural segmentation via `@imgly/background-removal` executed in an isolated background Web Worker (`src/workers/cutoutWorker.ts`), eliminating UI freeze and maintaining 60 FPS while paired with instant sub-3ms smart algorithmic edge sampling.
- **AI Analytics**: Google GenAI SDK (`@google/genai`) for attendance trend summaries and ministry insights.

```
├── server/                        # Express API and Server Middleware
│   ├── config/gemini.ts           # Google GenAI SDK configuration
│   ├── middleware/security.ts     # Security headers and payload validators
│   └── app.ts                     # API routes and static client serving
│
├── src/
│   ├── components/                # Modular UI Views and Dialogs
│   │   ├── Dashboard.tsx          # Key metrics, attendance targets, Sunday pending state & charts
│   │   ├── AttendanceTaker.tsx    # Single-tap check-in, Day Intelligence, 0ms instant save, FNF modal
│   │   ├── MembersList.tsx        # Directory, search, filters, mobile cards, drawer & Photo Studio
│   │   ├── PhotoStudioModal.tsx   # AI cutout, studio depth shadow, live previews & WebP export
│   │   ├── MemberAvatar.tsx       # Reusable avatar with initials fallback
│   │   ├── ChangelogModal.tsx     # Interactive version notes and release timeline
│   │   ├── OutreachHub.tsx        # Follow-up radar, shepherd outreach, prayer wall and calendar
│   │   ├── AnalyticsHub.tsx       # Interactive charts and AI insights
│   │   ├── Finances.tsx           # Weekly Sunday collections, tithes and category ledgers
│   │   ├── ReportExport.tsx       # WhatsApp copy-ready reports with Children/Shepherd breakdown
│   │   ├── ShepherdAllocationManager.tsx # Visual pastoral allocations, household groups & quota balancing
│   │   ├── Settings.tsx           # Organization, zones, branches, and RBAC matrix
│   │   └── Login.tsx              # Passcode/Google authentication and session restoration
│   │
│   ├── services/
│   │   ├── storageService.ts      # Cloud Firestore sync, 0ms getInstantData(), branch rename cascade
│   │   ├── firebase.ts            # Firebase App, Firestore DB, and Storage uploads
│   │   └── securityService.ts     # Input sanitization, SHA-256 passcodes, and gender helpers
│   │
│   ├── workers/                   # Background Web Worker Threads
│   │   └── cutoutWorker.ts        # Dedicated Web Worker for @imgly/background-removal neural processing
│   │
│   ├── lib/
│   │   ├── permissions.ts         # Granular Role-Based Access Control (RBAC) engine
│   │   ├── teacherDivision.ts     # Fair pastoral allocation, household clustering & surname grouping
│   │   └── theme.ts               # Theme tokens and dynamic palette application
│   │
│   ├── version.ts                 # Centralized SemVer metadata & release changelog
│   ├── types.ts                   # Strict TypeScript definitions
│   └── constants.ts               # Default configurations, registry, and fallback settings
```

---

## Core Modules and Capabilities

### 1. Children's Photo Studio, AI Neural Background Removal & Studio Visual Depth
- **Dedicated Web Worker Isolation (Zero-Freeze UI)**:
  - **Thread-Isolated Neural Segmentation**: Heavy `@imgly/background-removal` model execution (ONNX / WASM) is completely isolated in [`src/workers/cutoutWorker.ts`](src/workers/cutoutWorker.ts). The browser UI thread remains at steady 60 FPS with zero freezing, lag, or stuttering.
  - **Deferred Yielding & Algorithmic Preview**: An instant smart cutout (sub-3ms) renders immediately upon photo capture or upload while dispatching the background Web Worker job using non-blocking microtask frame-yielding (`setTimeout(..., 30)`).
  - **Graceful Multi-Thread Fallback**: Automatically falls back to in-thread processing if Web Workers are restricted in specific legacy browser sandboxes.
- **Dual-Engine Subject Isolation (Background Removal)**:
  - **AI Neural Background Removal**: In-browser neural segmentation engine powered by `@imgly/background-removal`, isolating hair strands, shoulders, and silhouettes with high precision.
  - **Instant Algorithmic Fallback Engine**: Multi-cluster corner & perimeter sampling with facial and melanin skin geometry preservation executes in ~15ms with 0ms UI blocking before background AI upgrade.
  - **Visual Status & Re-isolate**: Real-time badges (`AI Isolating Subject...`, `AI Studio Cutout`, `Smart Cutout Active`) with one-click re-isolation.
- **Subject Visual Depth & Separation**:
  - **3D Studio Depth Shadow**: Casts a natural studio drop shadow behind the child onto the new backdrop so the subject physically pops forward with authentic dimensional depth.
  - **Silhouette Edge Pop**: Studio rim lighting illuminates subject edge contours so dark clothing or hair never blends into dark or saturated backdrops.
  - **Studio Radial Backlight**: Gentle studio center glow radiates behind the subject, giving every backdrop vibrant clarity.
- **Instant Options Reactivity (Zero Lag)**:
  - **Cutout Image Caching**: Subject cutouts are computed once and cached in state. Panning, zooming (0.8x - 2.5x), rotation, and backdrop switching execute in **<1ms** with zero main-thread lag.
  - **Real-Time Live Previews**: `Card View (80px)` and `Roster Badge (40px)` previews render instantaneously on the exact same frame as selections.
- **Dual Mobile Camera Support**:
  - Direct integration with phone front (selfie) and rear cameras with native OS capture triggers (`capture="user"` and `capture="environment"`).
  - Live WebRTC camera viewfinder with real-time **Front/Rear flip button**.
  - Gallery and file upload fallback for all mobile and desktop devices.
- **Dynamic and Constant Studio Backdrops**:
  - **Presets**: Church Indigo, Royal Blue, Velvet Purple, Sunset Crimson, Warm Amber, Studio Slate, Fresh Emerald, Clean Light, Transparent PNG, and Original Photo.
  - **Custom Color Picker**: Interactive HTML5 color wheel and hex input (`#rrggbb`) for custom ministry theme backdrops.
  - **Custom Backdrop Image Upload**: Upload any custom church banner, stage photo, or graphic to place behind the child.
- **Storage-Optimized WebP Export**: Automatically scales and exports 256×256 WebP payloads (~15–25 KB) to Firebase Cloud Storage. If Cloud Storage is not yet provisioned, it automatically falls back to a dedicated `memberPhotos` collection to protect the main document.
- **Roster and Directory Avatars**: Integrated via [`MemberAvatar.tsx`](src/components/MemberAvatar.tsx) across the Member directory, Member side drawer, and Attendance check-in rosters, with deterministic initials fallback.

### 2. Dashboard, Ministry Metrics & Sunday Pending State
- **Sunday Pending State**: On Sundays when attendance has not yet been recorded, the "This Sunday" cards display `0` with a clean `Pending` badge rather than prematurely showing the previous Sunday's attendance numbers.
- **Historical Comparison**: "Last Sunday" metrics strictly pull from the last recorded Sunday session for accurate trend comparisons.
- **Key Ministry Targets**: Visual progress gauges for UJ, LJ, K, and I with automated goal projections and attendance rates.

### 3. Organization Hierarchy and Cascade Branch Renaming
- **Multi-Level Organization**: Manage Directorate $\rightarrow$ Zones $\rightarrow$ Branches $\rightarrow$ Churches/Classes (Upper Junior, Lower Junior, K, I).
- **Atomic Cascade Renaming**: Renaming any branch in Settings propagates across all dependent entities:
  - Members (`branchId` and `assignedChurch`).
  - Attendance history.
  - Financial income and expense transactions.
  - Outreach sessions and prayer bookings.
  - Existing notifications and browser active sessions.

### 4. Role-Based Access Control (RBAC) Permissions Matrix
- Comprehensive permissions matrix in **Settings $\rightarrow$ Role Permissions** allowing Super Admins to toggle access to features and subfeatures across roles:
  - `SUPER_ADMIN` and `ADMIN` (Full global governance).
  - `DIRECTORATE_HEAD` (Cross-zonal oversight).
  - `ZONAL_HEAD` (Scoped to assigned zone).
  - `BRANCH_COORDINATOR` (Scoped to assigned branch).
  - `TEACHER` / Shepherd and `VOLUNTEER` (Scoped to assigned church and class).

### 5. Attendance, Punctuality & Day Intelligence
- **Attendance Day Intelligence**:
  - **Wednesdays (LC Live Only)**: Exclusively designated for Shepherds meeting (staff mode), hiding child service switchers and preventing mistaken entries.
  - **Sundays (3 Main Services)**: Supports **Joy Service**, **Enlargement Service**, and **Special Service**.
  - **Other Days (Dynamic Special Programs)**: Dynamically opens for special events, conventions, or weekday rehearsals.
- **Special Event Name Memory**: When saving non-Sunday services, the system checks for existing event names recorded by other users on that date, automatically reusing the name and prompting only when none exists yet.
- **0ms Seamless Modal Saving**:
  - Modal dismissal in "+ First Timer" and "Special Event Name" is instantaneous (0ms) without waiting for Firestore cloud round-trips.
  - Local cache (`localStorage` + `memoryCache`) updates immediately, and changes commit to Firestore in the background with automatic error handling.
- **Persistent Multi-Entry First Timers**:
  - Bulk addition of first timers via commas or newlines with instant parsing, automatic gender inference, and direct assignment to the active church and logged-in shepherd.
  - Emits reactive `dataUpdated` event across components, ensuring newly added first timers persist permanently across logouts and browser refreshes.
- **Branch Coordinator Church Filtering**: Fast-access department filter dropdown and quick pills (`All`, `UJ`, `LJ`, `K`, `I`) in Attendance Taker for rapid roster search.
- **Static Controls & Floating Quick Save**:
  - Fixed top control bar with smooth scrollable member rosters underneath (`h-[calc(100dvh-130px)]`).
  - Elevated floating quick-save button (`bottom-20`) positioned safely above mobile navigation bars.

### 6. WhatsApp Reports and Service Headcount Breakdown
- **Clean Headcount Breakdown**:
  - In individual church and annual detailed reports, replaced cluttered service listings with clean `*(Children: X | Shepherds: Y)*` under `*TOTAL PRESENT*`.
- **Consolidated Branch Attendance (All / CM Church)**:
  - Automatically aggregates attendance across all departments (`UJ`, `LJ`, `K`, `I`) when "All" or "CM" is selected.
  - Prevents false "No attendance data" messages for Branch Coordinators and Admins.
- **Branch Coordinator Mega Center Service Report**:
  - Provisioned reporting template for Sunday services including Preacher/Message per church, financial collections (Offering, Tithes, Partnerships, First Fruits), soul winning, and cell meeting statistics.

### 7. Outreach Hub, Household Shepherd Division & Unified Prayer Accounting
- **Equal Household Shepherd Division**:
  - Smart pastoral allocation algorithm in [`src/lib/teacherDivision.ts`](src/lib/teacherDivision.ts) clusters children with identical surnames (e.g. Mensah, Zong, Opoku), matching parent phone numbers, and linked siblings (e.g., Sandra Omari & Kelvin Asante, Esther & Maeeva) under the same shepherd.
  - Enforces strict total headcount balance across all shepherds so pastoral workloads remain completely equal.
- **Shepherd Nomenclature**: Fully unified to "Shepherds" across all user interfaces while maintaining backward-compatible Firestore schemas (`Role.TEACHER` and `MemberType.TEACHER`).
- **Unified Prayer Accounting Synchronization**:
  - Live achievement metric cards on Prayer Wall banner (Sessions Done, Time Interceded, Children Covered, Pending This Week).
  - Synchronized YTD prayer intercession hours across Master Dashboard, Prayer Wall banner, and the TRACK progress tab.

### 8. Mobile UX Optimization & Instant 0ms Component Navigation
- **0ms Synchronous Cache Boot (`getInstantData()`)**: Application state initializes synchronously on the first frame from local storage/memory cache, eliminating empty screens, skeleton flickers, and startup lag.
- **Pre-warmed View Switching**: All application views (Dashboard, Attendance, People Hub, Outreach, Analytics, Finances, Reports, Settings) are pre-mounted in the DOM, enabling 0ms tab switching with zero delay.
- **Global Child / Children Terminology**: Standardized terminology across the entire application, eliminating all instances of "kid" or "kids".
- **Responsive Mobile Touch Layout**: 44px minimum touch targets, touch-friendly tab navigation, and responsive card views across all screen sizes.

### 9. Interactive Shepherd Allocations, Instant DB Auto-Save & Multi-Component Sync
- **Instant DB Auto-Save on Allocation Changes**:
  - Every child movement, household relocation, bulk reassignment, auto-allocation, unassigned distribution, or family decision immediately writes to Cloud Firestore and local storage without requiring manual "Save Allocations" button clicks.
  - Replaced the static save button with real-time animated feedback badges (`"Saving to Database..."` and `"Auto-Saved & Live (HH:MM:SS)"`), accompanied by an on-demand `"Sync Now"` trigger.
- **Immediate Multi-Component Reflection**:
  - **Attendance Taker**:
    - Child attendance cards immediately display assigned shepherd badges (`"Shepherd: [Name]"`) or `"Unassigned"` badges.
    - Added an interactive **Shepherd Filter** allowing shepherds and coordinators to instantly filter attendance rosters to their assigned children.
  - **People Hub (Members Directory)**:
    - Displays assigned shepherd badges in both desktop table rows and mobile member cards.
    - Added an **"Assigned Shepherd"** select dropdown inside the Member Edit Drawer, allowing manual shepherd assignments directly from member profiles.
  - **Report Export**:
    - Automatically updates shepherd divisions and headcount groupings in real time.
- **Shepherd Allocation Manager in Settings**:
  - Full configuration interface in **Settings > Shepherd Allocations** for organizing children among active shepherds per church department (`UJ`, `LJ`, `K`, `I`).
  - **Direct Family & Household Decision Overrides**:
    - Decide whether children sharing surnames/phones are actually a family or completely independent individuals.
    - **One-Click "Not a Family" Separation**: Instantly marks coincidentally named children as individual records (`SOLO`), preventing them from being grouped or moved together.
    - **Cross-Surname Sibling Linking**: Connect siblings or household members with different surnames (e.g. half-siblings, cousins, guardians) into custom household units with optional family names.
    - **In-Transfer Separation Shortcut**: Quickly separate a child directly inside the **Transfer Modal** without interrupting the assignment workflow.
    - **1-Click Reset to Auto**: Easily revert any manual override back to standard heuristic surname/phone auto-clustering.
  - **One-Click Auto-Allocate & Equalize**: Automatically calculates and balances child quotas per shepherd while strictly honoring custom and auto-detected household clusters.
  - **Side-by-Side Direct Transfer Mode**: Compare two shepherds side-by-side with directional move arrows for real-time visual transfer feedback.
  - **Unassigned Children Tray**: Highlights unplaced children with immediate 1-click assignment or even distribution among shepherds with the lowest workload.
  - **Live Capacity Metrics & Undo**: Real-time quota indicators (`Balanced`, `Over Quota`, `Under Quota`) and a live **Recently Moved Banner** with 1-click **Undo**.
- **Instant 0ms Archiving & Seamless Deletion**:
  - Dismisses confirmation modals in 0ms with instantaneous optimistic local state removal.
  - Updates Firestore in the background with zero blocking spinners or user wait times.

---

## Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/e-gyan/cm-app.git
cd cm-app

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Ensure .env contains:
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_DATABASE_ID=...
# GEMINI_API_KEY=...
```

### Running Locally
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

### Quality Verification & Production Build
```bash
# Type check and linting (TypeScript strict)
npm run lint

# Compile production bundle (Vite + esbuild server)
npm run build

# Start production server
npm start
```

---

## Security Best Practices
- **Passcode Protection**: Passcodes are hashed with SHA-256 and verified using constant-time comparison in [`securityService.ts`](src/services/securityService.ts).
- **Sanitized Inputs**: All member names, phone numbers, and notes are sanitized to prevent XSS.
- **Firestore Isolation**: Heavy media binaries are never stored in the main `appData/main` document.
- **Strict Role Enforcement**: UI components, views, and navigation tabs check `hasRoleFeature` and `hasRoleSubfeature` before rendering.

---

## License
Internal Children's Ministry Directorate Platform. All rights reserved.
