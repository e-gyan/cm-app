# Children's Ministry Attendance

A church attendance tracking, outreach management, and WhatsApp reporting application for multiple churches and branches.

---

## Codebase Structure

The application is structured into three clean layers: 

```
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated linting, type-checking, and build verification
│       └── deploy.yml             # Production deployment workflow
│
├── server/                        # Backend (Node.js & Express)
│   ├── config/
│   │   └── gemini.ts              # Google GenAI SDK configuration
│   ├── middleware/
│   │   └── security.ts            # Security headers (nosniff, SAMEORIGIN) & request validators
│   ├── routes/
│   │   └── api.ts                 # API routes (/api/health, /api/generate-insight, etc.)
│   └── app.ts                     # Express app setup, API routing & Vite/SPA static serving
│
├── src/                           # Frontend (React 19, TypeScript, Tailwind CSS)
│   ├── components/                # Application view components
│   │   ├── Dashboard.tsx          # Key metrics, attendance summary & quick actions
│   │   ├── AttendanceTaker.tsx    # Single-tap attendance check-in for services
│   │   ├── MembersList.tsx        # Member & teacher directory, filters, and import/export
│   │   ├── OutreachHub.tsx        # Follow-up radar, teacher outreach & schedules
│   │   ├── AnalyticsHub.tsx       # Attendance trends, charts, and AI insights
│   │   ├── ReportExport.tsx       # Formatted WhatsApp exports and summaries
│   │   ├── Finances.tsx           # Income, expenses, tithes, and offerings
│   │   ├── Settings.tsx           # Zones, branches, churches, classes & passcode
│   │   └── Login.tsx              # Role-based login and session authentication
│   ├── services/
│   │   ├── storageService.ts      # Fast local cache, Firestore sync, and batch writes
│   │   ├── firebase.ts            # Firebase app initialization & Firestore references
│   │   └── securityService.ts    # Input sanitization and data validation
│   ├── lib/
│   │   ├── teacherDivision.ts     # Fair division of children among teachers for outreach
│   │   └── theme.ts               # Church color themes and styles
│   ├── types.ts                   # TypeScript interfaces and enum definitions
│   ├── constants.ts               # Default values and configuration constants
│   ├── App.tsx                    # Root component, view routing & session restoration
│   └── index.tsx                  # React DOM entry point
│
├── index.html                     # HTML shell
├── server.ts                      # Server bootstrap entry point (port 3000)
├── vite.config.ts                 # Vite bundler configuration
├── tsconfig.json                  # TypeScript compiler options
└── package.json                   # Project dependencies and run scripts
```

---

## What the App Is Made Up Of

### 1. Dashboard
- Displays key statistics: **Total Members**, **Present Today**, **First Timers**, and **FNF**.
- Shows attendance target progress bars for each church.
- Quick navigation shortcuts to **Attendance**, **Members**, **Outreach Hub**, and **Reports**.

### 2. Attendance
- **Church Selector**: Switch between churches:
  - **I** 
  - **K** 
  - **LJ** (Lower Juniors)
  - **UJ** (Upper Juniors)
  - **CM** (Children's Ministry / Admin)
- **Service Selection**: Mark attendance for **Joy Service**, **Enlargement Service**, **Joint Service**, or **Special**.
- **Single-Tap Check-In**: Tap any child or teacher to toggle attendance instantly.
- **Filters**: View by age class, status (**All**, **Present**, **Absent**), or search by name.
- **Bulk Check-In**: Select multiple children to check in at once.
- **Quick Add Visitor**: Register a new visitor or first timer on the spot.

### 3. Members
- Directory of all registered individuals categorized by **Member Type**:
  - **Member** (Regular attendee)
  - **FNF** (Friends & Family)
  - **Visitor / First Timer**
  - **Not Member**
  - **Teacher / Helper / Volunteer**
- Filter by status: **Active**, **Inconsistent**, **Archived**, **Transferred**, **Not Active**, or **Vacation**.
- View details: Parent phone numbers, address, birthday, gender, and promotion history.
- **Import / Export**: Batch upload members via CSV/Excel or export the roster.

### 4. Outreach Hub
- **Follow-up Tab**:
  - Automatically identifies children who **Missed 2+ Sundays** or **Missed 3+ Sundays**.
  - Direct WhatsApp link to chat with parents.
  - Log follow-up calls, home visits, and prayer requests.
- **Progress Tab**:
  - Focuses on the logged-in teacher's assigned church.
  - Displays **Monthly outreach trend** and **Teacher outreach** performance.
- **Fair Division**: Evenly distributes children, FNF, and first timers among teachers for pastoral follow-up.

### 5. Analytics
- Interactive charts:
  - Attendance trends over time.
  - Service comparison (**Joy Service** vs. **Enlargement Service**).
  - Gender and class distributions.
- **AI Insights**: Generate weekly attendance summaries and trends via the integrated AI helper.

### 6. Reports (WhatsApp Export)
- Generate clean, copy-ready reports formatted specifically for WhatsApp and Telegram church groups:
  - **Detailed Report**: Numbered list of attendees separated by Members, FNF, First Timers, and Teachers, with service totals.
  - **Summary Report**: High-level counts and service splits.
  - **Consolidated Report**: Combined figures across all churches (UJ, LJ, K, I) for administrators.
  - **Annual Export**: Full-year breakdown for end-of-year reviews.
- Tap **Copy** to place the formatted text directly onto your clipboard.

### 7. Finances
- Record weekly Sunday collections: tithes, offerings, thanksgiving, and special project funds.
- Categorize transactions by service and church branch.
- View total income, expenses, and transaction logs.

### 8. Settings
- **General**: Set church name, theme colors, and administrator passcode.
- **Zones & Branches**: Organize church branches into zones.
- **Classes**: Configure Sunday school classes and age brackets.
- **Cloud Sync**: View Firebase connection status, trigger manual syncs, or backup data.

---

## How to Make Use of the App

### Taking Attendance on Sunday
1. Log in with your teacher or admin credentials.
2. Select your **Church** (e.g., **K**, **LJ**, or **UJ**) from the top bar.
3. Tap **Attendance** in the navigation.
4. Confirm the **Date** and select the **Service** (**Joy Service** or **Enlargement Service**).
5. Tap each child's name as they arrive. The card highlights green once present.
6. If a first-time guest arrives, tap **+ Quick Add**, fill in their name and parent phone number, and tap Save.

### Sharing the Sunday Report on WhatsApp
1. After service ends, tap **Reports** in the navigation.
2. Verify the selected **Date** matches today's date.
3. Choose **Detailed Report** (for department groups) or **Consolidated Report** (for general church leadership).
4. Tap **Copy Report**.
5. Open WhatsApp, navigate to your leadership group, and paste the message.

### Doing Mid-Week Follow-Up (Outreach Hub)
1. Tap **Outreach Hub** in the navigation.
2. In the **Follow-up** tab, click **Missed 2+ Sundays** to view children who were absent recently.
3. Tap the green **WhatsApp** icon next to a child's name to send a message to their parent.
4. Tap **Log Outreach** to record whether you called, visited, or messaged, along with any prayer notes.
5. In the **Progress** tab, view your monthly outreach trend and teacher outreach summary.

### Adding or Updating Members
1. Tap **Members** in the navigation.
2. To add one child: tap **+ Add Member**, enter their details, select their **Member Type** (**Member**, **FNF**, or **Visitor**), and save.
3. To update details: click on any member's row to edit their phone number, class, or status.

---

## Local Development & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
```bash
# 1. Clone the repository
git clone <repo-url>
cd childrens-ministry-attendance

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and Firebase config if using cloud sync
```

### Run Locally
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

### Verification & Build
```bash
# Run TypeScript linting / type-check
npm run lint

# Build for production (Vite client + esbuild server bundle)
npm run build

# Start production server
npm start
```

---

## CI/CD Workflows

Automated GitHub Actions workflows are located in `.github/workflows/`:
- **`ci.yml`**: Runs on all pushes and pull requests to `main` and `master`. Performs dependency installation, TypeScript linting (`npm run lint`), and builds the production bundle (`npm run build`).
- **`deploy.yml`**: Triggers production deployment checks upon merging into `main` or `master`.
