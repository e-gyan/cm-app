# Children's Ministry Directorate (CMD) Platform

[![Version](https://img.shields.io/badge/version-1.6.0-indigo.svg)](src/version.ts)
[![Release](https://img.shields.io/badge/release-Consolidated%20Reports,%20Dual%20Camera%20%26%20Subject%20Cutout-emerald.svg)](src/version.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](package.json)

A modern, cloud-synchronized multi-tenant application for Children's Ministry attendance tracking, child photo studio management, children outreach, financial ledger accounting, granular role-based permissions, and automated WhatsApp reporting.
---

## Version Control and Release Protocol

The platform follows **Semantic Versioning (SemVer: `MAJOR.MINOR.PATCH`)**:

```
v1.6.0
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
- **Cloud Database**: Cloud Firestore (`appData/main` root document with 0ms `localStorage` caching and real-time `onSnapshot` listeners).
- **Media and Avatar Storage**: Firebase Cloud Storage (`members/photos/{id}.webp`) with an isolated Firestore fallback collection (`memberPhotos/{id}`) guaranteeing the 1 MB main document limit is never exceeded.
- **AI Analytics**: Google GenAI SDK (`@google/genai`) for attendance trend summaries and ministry insights.

```
├── server/                        # Express API and Server Middleware
│   ├── config/gemini.ts           # Google GenAI SDK configuration
│   ├── middleware/security.ts     # Security headers and payload validators
│   └── app.ts                     # API routes and static client serving
│
├── src/
│   ├── components/                # Modular UI Views and Dialogs
│   │   ├── Dashboard.tsx          # Key metrics, attendance targets, and charts
│   │   ├── AttendanceTaker.tsx    # Single-tap check-in, punctuality, and avatar roster
│   │   ├── MembersList.tsx        # Directory, search, filters, drawer & Photo Studio
│   │   ├── PhotoStudioModal.tsx   # Webcam capture, framing, constant backdrops & WebP export
│   │   ├── MemberAvatar.tsx       # Reusable avatar with initials fallback
│   │   ├── ChangelogModal.tsx     # Interactive version notes and release timeline
│   │   ├── OutreachHub.tsx        # Follow-up radar, teacher outreach and calendar
│   │   ├── AnalyticsHub.tsx       # Interactive charts and AI insights
│   │   ├── Finances.tsx           # Weekly Sunday collections, tithes and category ledgers
│   │   ├── ReportExport.tsx       # Copy-ready reports for sharing on WhatsApp
│   │   ├── Settings.tsx           # Organization, zones, branches, and RBAC matrix
│   │   └── Login.tsx              # Passcode/Google authentication and session restoration
│   │
│   ├── services/
│   │   ├── storageService.ts      # Cloud Firestore sync, offline cache, branch rename cascade
│   │   ├── firebase.ts            # Firebase App, Firestore DB, and Storage uploads
│   │   └── securityService.ts     # Input sanitization, SHA-256 passcodes, and gender helpers
│   │
│   ├── lib/
│   │   ├── permissions.ts         # Granular Role-Based Access Control (RBAC) engine
│   │   ├── teacherDivision.ts     # Fair pastoral allocation and Thesaurus alias resolver
│   │   └── theme.ts               # Theme tokens and dynamic palette application
│   │
│   ├── version.ts                 # Centralized SemVer metadata & release changelog
│   ├── types.ts                   # Strict TypeScript definitions
│   └── constants.ts               # Default configurations, registry, and fallback settings
```

---

## Core Modules and Capabilities

### 1. Children's Photo Studio, Dual Mobile Camera and Intelligent Background Removal
- **Dual Mobile Camera Support**:
  - Direct integration with phone front (selfie) and rear cameras with native OS capture triggers (`capture="user"` and `capture="environment"`).
  - Live WebRTC camera viewfinder with real-time **Front/Rear flip button**.
  - Gallery and file upload fallback for all mobile and desktop devices.
- **Intelligent Client-Side Subject Cutout (Background Removal)**:
  - High-performance portrait segmentation engine executed 100% in-browser on HTML5 canvas.
  - Automatically models boundary/background tones and detects central facial and melanin skin geography to protect the child.
  - Smooth alpha matting isolates the child from busy home, wall, or church backgrounds.
  - Interactive **Cutout Sensitivity** slider (15% to 85%) and toggle to fine-tune portrait matting.
- **Dynamic and Constant Studio Backdrops**:
  - **Presets**: Church Indigo, Royal Blue, Warm Amber, Studio Slate, Fresh Emerald, Clean Light, Transparent PNG, and Original Photo.
  - **Custom Color Picker**: Interactive HTML5 color wheel and hex input (`#rrggbb`) for custom ministry theme backdrops.
  - **Custom Backdrop Image Upload**: Upload any custom church banner, stage photo, or graphic to place behind the child.
- **Storage-Optimized WebP Export**: Automatically scales and exports 256×256 WebP payloads (~15–25 KB) to Firebase Cloud Storage. If Cloud Storage is not yet provisioned, it automatically falls back to a dedicated `memberPhotos` collection to protect the main document.
- **Roster and Directory Avatars**: Integrated via [`MemberAvatar.tsx`](src/components/MemberAvatar.tsx) across the Member directory, Member side drawer, and Attendance check-in rosters, with deterministic initials fallback.

### 2. Organization Hierarchy and Cascade Branch Renaming
- **Multi-Level Organization**: Manage Directorate $\rightarrow$ Zones $\rightarrow$ Branches $\rightarrow$ Churches/Classes (Upper Junior, Lower Junior, Kindergarten, Infants, Nursery).
- **Thesaurus Auto-Attachment**: Built-in automatic self-healing migration attaching all historical and incoming records from `"Thesaurus HQ"` to `"Thesaurus"`.
- **Atomic Cascade Renaming**: Renaming any branch in Settings propagates across all dependent entities:
  - Members (`branchId` and `assignedChurch`).
  - Attendance history.
  - Financial income and expense transactions.
  - Outreach sessions and prayer bookings.
  - Existing notifications and browser active sessions.

### 3. Role-Based Access Control (RBAC) Permissions Matrix
- Comprehensive permissions matrix in **Settings $\rightarrow$ Role Permissions** allowing Super Admins to toggle access to features and subfeatures across roles:
  - `SUPER_ADMIN` and `ADMIN` (Full global governance).
  - `DIRECTORATE_HEAD` (Cross-zonal oversight).
  - `ZONAL_HEAD` (Scoped to assigned zone).
  - `BRANCH_COORDINATOR` (Scoped to assigned branch).
  - `TEACHER` and `VOLUNTEER` (Scoped to assigned church and class).

### 4. Context-Aware Activity Notification Engine
- Real-time logging of all critical ministry events:
  - Attendance submissions.
  - Member additions, transfers, and status updates.
  - Financial transactions.
  - Outreach logs and prayer slot bookings.
  - Organization changes.
- Automatically filtered in the top notification bell based on the user's logged-in functional context, with desktop browser notification alerts when minimized.

### 5. Attendance and Punctuality System
- Single-tap check-in with visual color indicators.
- **Dual-Service Support**: Separate tracking for **Joy Service** and **Enlargement Service**.
- **Punctuality Counter**: Tracks punctuality rewards with custom thresholds (e.g., first 30 attendees).
- Full-text search and class filters for instantaneous check-in.

### 6. WhatsApp and Multi-Department Consolidation
- **Consolidated Branch Attendance (All / CM Church)**:
  - Automatically aggregates attendance across all available departments (`UJ`, `LJ`, `K`, `I`) when "All" or "CM" is selected.
  - Prevents false "No attendance data" messages for Branch Coordinators and Admins.
  - Generates full consolidated figures with service breakdowns (Joy, Enlargement, Special) and church-by-church member rosters.
- **Branch Coordinator Mega Center Service Report**:
  - Provisioned reporting template for Sunday services including Preacher/Message per church, financial collections (Offering, Tithes, Partnerships, First Fruits), soul winning, and cell meeting statistics.
  - Ensures Branch Coordinators always see their provisioned template.
- **Department Detail and Summary Reports**: Individual class rosters and high-level summaries copy-ready for instant dispatch.

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
