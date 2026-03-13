# 📁 E-LEGISLATIVE MONITORING SYSTEM (ELMS) - Complete Folder Structure

**Last Updated: March 13, 2026**
**Overall Completion: ~75% (Frontend: 70% | Backend: 80%)**

---

## ✅ COMPLETE CURRENT STRUCTURE

```
AllenKenji/ELMS/
│
├── backend/
│   ├── .env ✅
│   ├── package.json ✅
│   ├── package-lock.json ✅
│   ├── server.js ✅
│   ├── db.js ✅
│   ├── socket.js ✅
│   ├── seed.js ✅
│   ├── verify.js ✅
│   │
│   ├── routes/ ✅ (9 FILES)
│   │   ├── auth.js ✅
│   │   ├── ordinances.js ✅ (15.5 KB)
│   │   ├── sessions.js ✅ (8.5 KB)
│   │   ├── resolutions.js ✅
│   │   ├── messages.js ✅
│   │   ├── notifications.js ✅
│   │   ├── users.js ✅
│   │   ├── auditLogs.js ✅
│   │   └── settings.js ✅
│   │
│   ├── models/ ✅ (8 FILES)
│   │   ├── index.js ✅
│   │   ├── user.js ✅
│   │   ├── ordinance.js ✅
│   │   ├── resolution.js ✅
│   │   ├── session.js ✅
│   │   ├── notification.js ✅
│   │   ├── audit_log.js ✅
│   │   └── role.js ✅
│   │
│   ├── middleware/ ✅ (2 FILES)
│   │   ├── auth.js ✅ (JWT verification)
│   │   └── roles.js ✅ (Role-based access control)
│   │
│   ├── utils/ ✅ (1 FILE)
│   │   └── notifications.js ✅ (Notification creation & deletion)
│   │
│   ├── migrations/ ✅ (3 FILES)
│   │   ├── 003_create_messages_table.sql ✅
│   │   ├── 004_create_notifications_table.sql ✅
│   │   └── ordinance_workflow_tables.sql ✅
│   │
│   ├── controllers/ ❌ (MISSING - NOT YET IMPLEMENTED)
│   ├── services/ ❌ (MISSING - NOT YET IMPLEMENTED)
│   └── tests/ ❌ (MISSING - NOT YET IMPLEMENTED)
│
├── frontend/
│   ├── package.json ✅
│   ├── index.html ✅
│   ├── vite.config.js ✅
│   │
│   └── src/
│       ├── main.jsx ✅
│       ├── App.jsx ✅
│       ├── App.css ✅
│       ├── index.css ✅
│       │
│       ├── api/ ✅ (1 FILE)
│       │   └── api.js ✅ (Axios instance with JWT interceptor)
│       │
│       ├── context/ ✅ (3 FILES)
│       │   ├── auth.js ✅
│       │   ├── useAuth.js ✅ (Custom hook)
│       │   └── AuthContext.jsx ✅ (Auth provider with auto refresh)
│       │
│       ├── hooks/ ✅ (2 FILES)
│       │   ├── useSocket.js ✅ (Socket.IO real-time updates)
│       │   └── useDashboard.js ✅ (Stats, activity feed, pending items)
│       │
│       ├── components/ ✅ (85% COMPLETE)
│       │   ├── Login.jsx ✅
│       │   ├── Register.jsx ✅
│       │   ├── ForgotPassword.jsx ✅
│       │   ├── DashboardLayout.jsx ✅ (Sidebar + Role-based navigation)
│       │   ├── UserManagement.jsx ✅
│       │   ├── AuditLogList.jsx ✅
│       │   ├── SystemSettings.jsx ✅
│       │   ├── NotificationBell.jsx ✅
│       │   ├── NotificationList.jsx ✅
│       │   │
│       │   ├── Dashboard/ ✅ (5 SHARED WIDGET COMPONENTS)
│       │   │   ├── TrendChart.jsx ✅ (Bar chart for ordinances)
│       │   │   ├── StatsWidget.jsx ✅ (Stat cards with trends)
│       │   │   ├── QuickActionPanel.jsx ✅ (4 quick actions)
│       │   │   ├── ActivityFeed.jsx ✅ (Recent activity timeline)
│       │   │   └── PendingApprovalWidget.jsx ✅ (Items pending action)
│       │   │
│       │   ├── Ordinances/ ✅ (4 FILES - COMPLETE)
│       │   │   ├── OrdinanceList.jsx ✅
│       │   │   ├── OrdinanceForm.jsx ✅
│       │   │   ├── OrdinanceDetails.jsx ✅
│       │   │   └── OrdinanceWorkflow.jsx ✅
│       │   │
│       │   ├── Sessions/ ✅ (3 FILES - COMPLETE)
│       │   │   ├── SessionList.jsx ✅
│       │   │   ├── SessionForm.jsx ✅
│       │   │   └── SessionDetails.jsx ✅
│       │   │
│       │   ├── Resolutions/ ✅ (3 FILES - COMPLETE)
│       │   │   ├── ResolutionList.jsx ✅
│       │   │   ├── ResolutionForm.jsx ✅
│       │   │   └── ResolutionDetails.jsx ✅
│       │   │
│       │   ├── Messages/ ✅ (3 FILES - COMPLETE)
│       │   │   ├── MessageList.jsx ✅ (Inbox/Sent tabs)
│       │   │   ├── MessageCompose.jsx ✅ (Compose new message)
│       │   │   └── MessageThread.jsx ✅ (View/Reply message)
│       │   │
│       │   ├── Voting/ ❌ (MISSING - HIGH PRIORITY)
│       │   ├── Committees/ ❌ (MISSING - HIGH PRIORITY)
│       │   ├── Reports/ ❌ (MISSING - HIGH PRIORITY)
│       │   └── Common/ ❌ (MISSING - REUSABLE COMPONENTS)
│       │
│       ├── pages/ ✅ (6 FILES - COMPLETE)
│       │   ├── AdminDashboard.jsx ✅
│       │   ├── SecretaryDashboard.jsx ✅
│       │   ├── CouncilorDashboard.jsx ✅
│       │   ├── CaptainDashboard.jsx ✅
│       │   ├── ResidentDashboard.jsx ✅
│       │   └── DILGDashboard.jsx ✅
│       │
│       ├── styles/ ✅ (25+ CSS FILES)
│       │   ├── Login.css ✅
│       │   ├── App.css ✅
│       │   ├── DashboardLayout.css ✅
│       │   ├── NotificationBell.css ✅
│       │   ├── QuickActionPanel.css ✅
│       │   ├── TrendChart.css ✅
│       │   ├── StatsWidget.css ✅
│       │   ├── ActivityFeed.css ✅
│       │   ├── PendingApprovalWidget.css ✅
│       │   ├── OrdinanceList.css ✅
│       │   ├── OrdinanceForm.css ✅
│       │   ├── OrdinanceDetails.css ✅
│       │   ├── OrdinanceWorkflow.css ✅
│       │   ├── SessionList.css ✅
│       │   ├── SessionForm.css ✅
│       │   ├── SessionDetails.css ✅
│       │   ├── ResolutionList.css ✅
│       │   ├── ResolutionForm.css ✅
│       │   ├── ResolutionDetails.css ✅
│       │   ├── MessageList.css ✅
│       │   ├── MessageCompose.css ✅
│       │   ├── MessageThread.css ✅
│       │   ├── [Role]Dashboard.css ✅ (AdminDashboard, SecretaryDashboard, etc.)
│       │   └── [Missing CSS files for new features] ❌
│       │
│       ├── assets/ ❌ (EMPTY)
│       └── utils/ ❌ (MISSING)
│
├── folderstructure.txt (OLD)
└── README.md (IF EXISTS)
```

---

## 🟢 WHAT'S COMPLETE (75%)

### **Backend - Well Developed (80%)**

✅ **API Routes** - 9 complete endpoints
- Authentication (register, login, refresh token)
- Ordinances (CRUD + workflow)
- Sessions (CRUD)
- Resolutions (CRUD)
- Messages (CRUD)
- Notifications (CRUD)
- Users (CRUD)
- Audit Logs
- Settings

✅ **Database Models** - 8 models
- User, Ordinance, Resolution, Session, Notification, AuditLog, Role, Message

✅ **Middleware** - 2 implemented
- Authentication (JWT verification)
- Authorization (Role-based access control)

✅ **Utilities** - 1 file
- Notification creation & deletion helpers

✅ **Migrations** - 3 files
- Messages table
- Notifications table
- Ordinance workflow & approvals tables

✅ **Configuration**
- Express server setup
- Database connection
- Socket.IO configuration
- Environment variables
- Seed script

---

### **Frontend - Well Developed (70%)**

✅ **Authentication** (3 components)
- Login, Register, Forgot Password

✅ **Dashboards** (6 role-based pages)
- Admin, Secretary, Councilor, Captain, Resident, DILG Official

✅ **Core Modules** (3 complete)
- **Ordinances**: List, Form, Details, Workflow (4 components)
- **Sessions**: List, Form, Details (3 components)
- **Resolutions**: List, Form, Details (3 components)
- **Messages**: List, Compose, Thread (3 components)

✅ **Dashboard Widgets** (5 components)
- TrendChart, StatsWidget, QuickActionPanel, ActivityFeed, PendingApprovalWidget

✅ **Admin Components** (3)
- User Management, Notifications, Audit Logs, System Settings

✅ **Infrastructure**
- API client (Axios with JWT)
- Authentication Context & useAuth hook
- Socket.IO hook for real-time updates
- Dashboard custom hooks (stats, activity)

✅ **Styling** (25+ CSS files)
- Responsive design
- Role-based dashboard styling
- Component-specific styles
- Mobile optimization

---

## 🔴 WHAT'S MISSING (25% - HIGH PRIORITY)

### **1. Voting System** (HIGHEST PRIORITY)
**Status:** Not started
**Why:** Critical for legislative process
**Effort:** High (2-3 days)

**Backend Needed:**
```
backend/routes/voting.js (NEW)
  - POST /votes (cast vote)
  - GET /votes/:ordinanceId (get votes for ordinance)
  - GET /votes/history/:councilor (get councilor vote history)
  - GET /votes/summary/:ordinanceId (get vote summary)
```

**Frontend Needed:**
```
frontend/src/components/Voting/ (NEW)
  ├── VotingDashboard.jsx
  ├── VoteInterface.jsx
  ├── VoteHistory.jsx
  ├── VoteSummary.jsx
  ├── CouncilorVotes.jsx
  └── Voting.css
```

**Database:**
```
backend/models/vote.js (NEW)
- Table: votes
- Fields: id, ordinance_id, councilor_id, vote (yes/no/abstain), 
          created_at, notes
```

---

### **2. Committees Module** (HIGH PRIORITY)
**Status:** Not started
**Why:** Important for ordinance review process
**Effort:** Medium (2 days)

**Backend Needed:**
```
backend/routes/committees.js (NEW)
  - CRUD operations for committees
  - Member management
backend/models/committee.js (NEW)
```

**Frontend Needed:**
```
frontend/src/components/Committees/ (NEW)
  ├── CommitteeList.jsx
  ├── CommitteeForm.jsx
  ├── CommitteeDetails.jsx
  ├── MemberManagement.jsx
  └── Committee.css
```

---

### **3. Reports Module** (HIGH PRIORITY)
**Status:** Not started
**Why:** Analytics and monitoring dashboards
**Effort:** Medium-High (3 days)

**Backend Needed:**
```
backend/services/reportService.js (NEW)
backend/routes/reports.js (NEW)
  - Generate ordinance reports
  - Generate councilor activity reports
  - Export to PDF/Excel
```

**Frontend Needed:**
```
frontend/src/components/Reports/ (NEW)
  ├── ReportingDashboard.jsx
  ├── OrdinanceReport.jsx
  ├── CouncilorActivityReport.jsx
  ├── ReportExporter.jsx
  ├── ReportFilters.jsx
  └── Reports.css
```

---

### **4. Backend Infrastructure** (IMPORTANT)

#### **Controllers Layer** (Refactoring)
```
backend/controllers/ (NEW)
  ├── ordinanceController.js
  ├── sessionController.js
  ├── resolutionController.js
  ├── userController.js
  ├── messageController.js
  ├── notificationController.js
  ├── auditController.js
  ├── votingController.js
  ├── committeeController.js
  └── reportController.js
```

#### **Additional Middleware**
```
backend/middleware/
  ├── auth.js ✅ (EXISTS)
  ├── roles.js ✅ (EXISTS)
  ├── validation.js ❌ (INPUT VALIDATION)
  ├── errorHandler.js ❌ (ERROR HANDLING)
  └── rateLimiter.js ❌ (RATE LIMITING)
```

#### **Services Layer** (Business Logic)
```
backend/services/ (NEW)
  ├── ordinanceService.js
  ├── votingService.js
  ├── workflowService.js
  ├── reportService.js
  ├── emailService.js (notifications)
  └── importService.js (data import)
```

#### **Additional Utilities**
```
backend/utils/
  ├── notifications.js ✅ (EXISTS)
  ├── dateFormatter.js ❌
  ├── validators.js ❌
  ├── fileHandler.js ❌
  └── constants.js ❌
```

#### **Missing Database Migrations**
```
backend/migrations/
  ├── 001_create_users_table.sql ❌
  ├── 002_create_ordinances_table.sql ❌
  ├── 003_create_messages_table.sql ✅
  ├── 004_create_notifications_table.sql ✅
  ├── 005_create_votes_table.sql ❌
  ├── 006_create_committees_table.sql ❌
  └── ordinance_workflow_tables.sql ✅
```

---

### **5. Frontend Enhancements**

#### **Reusable UI Components Library**
```
frontend/src/components/Common/ (NEW)
  ├── Button.jsx
  ├── Modal.jsx
  ├── Table.jsx
  ├── Card.jsx
  ├── Badge.jsx
  ├── LoadingSpinner.jsx
  ├── ToastNotification.jsx
  ├── Sidebar.jsx
  ├── SearchBar.jsx
  ├── BreadcrumbNav.jsx
  ├── Pagination.jsx
  └── Common.css
```

#### **Additional Custom Hooks**
```
frontend/src/hooks/
  ├── useSocket.js ✅
  ├── useDashboard.js ✅
  ├── useFetch.js ❌
  ├── useForm.js ���
  ├── usePagination.js ❌
  ├── useLocalStorage.js ❌
  └── useNotification.js ❌
```

#### **Additional Context Providers**
```
frontend/src/context/
  ├── auth.js ✅
  ├── useAuth.js ✅
  ├── AuthContext.jsx ✅
  ├── NotificationContext.jsx ❌
  ├── FilterContext.jsx ❌
  └── LoadingContext.jsx ❌
```

#### **Utility Functions**
```
frontend/src/utils/ (NEW)
  ├── dateFormatter.js
  ├── statusColors.js
  ├── rolePermissions.js
  ├── validators.js
  ├── constants.js
  └── helpers.js
```

---

## 📊 COMPLETION BREAKDOWN

### **By Feature:**
| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Authentication | ✅ 100% | ✅ 100% | **COMPLETE** |
| User Management | ✅ 100% | ✅ 100% | **COMPLETE** |
| Dashboards | ✅ 100% | ✅ 100% | **COMPLETE** |
| Ordinances | ✅ 100% | ✅ 100% | **COMPLETE** |
| Sessions | ✅ 100% | ✅ 100% | **COMPLETE** |
| Resolutions | ✅ 100% | ✅ 100% | **COMPLETE** |
| Messages | ✅ 100% | ✅ 100% | **COMPLETE** |
| Notifications | ✅ 100% | ✅ 100% | **COMPLETE** |
| Audit Logs | ✅ 100% | ✅ 100% | **COMPLETE** |
| Voting | ❌ 0% | ❌ 0% | **NOT STARTED** |
| Committees | ❌ 0% | ❌ 0% | **NOT STARTED** |
| Reports | ❌ 0% | ❌ 0% | **NOT STARTED** |
| Controllers | ❌ 0% | N/A | **NOT STARTED** |
| Services | ❌ 0% | N/A | **NOT STARTED** |
| Middleware | ✅ 40% | N/A | **PARTIAL** |
| Migrations | ✅ 43% | N/A | **PARTIAL** |
| UI Components | N/A | ❌ 0% | **NOT STARTED** |
| Hooks | N/A | ✅ 40% | **PARTIAL** |

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### **Phase 1: Core Features (Week 1-2)**
1. **Voting System** (Highest priority - legislative foundation)
2. **Committees Module** (Needed for ordinance workflow)
3. **Reports Module** (Analytics & monitoring)

### **Phase 2: Backend Infrastructure (Week 3-4)**
1. Create Controllers layer (Refactor routes)
2. Create Services layer (Business logic)
3. Add validation & error handling middleware
4. Create full database migrations

### **Phase 3: Frontend Enhancements (Week 5-6)**
1. Reusable components library
2. Additional hooks & utilities
3. Context providers for global state
4. Enhanced styling & responsive design

### **Phase 4: Testing & Documentation (Week 7-8)**
1. Unit tests (Jest + React Testing Library)
2. Integration tests (Backend API)
3. API documentation (Swagger)
4. User documentation

---

## ✨ STRENGTHS OF CURRENT CODEBASE

✅ **Well-organized folder structure**
✅ **Complete CRUD operations** for core modules
✅ **Proper authentication** with JWT & refresh tokens
✅ **Real-time updates** with Socket.IO
✅ **Role-based access control** implemented
✅ **6 role-based dashboards** with tailored UIs
✅ **Comprehensive styling** with CSS
✅ **Responsive design** for mobile devices
✅ **Custom hooks** for state management
✅ **Database models** for all core entities
✅ **API client** with interceptors
✅ **Error handling** in components

---

## ⚠️ AREAS NEEDING ATTENTION

⚠️ **No Controllers layer** - Routes directly handle logic
⚠️ **No Services layer** - Business logic mixed with routes
⚠️ **Limited middleware** - Only auth & roles
⚠️ **No input validation middleware**
⚠️ **No error handling middleware**
⚠️ **Incomplete migrations** - Only 3/7 core migrations
⚠️ **No voting system**
⚠️ **No committees module**
⚠️ **No reports module**
⚠️ **No reusable UI components library**
⚠️ **No utility functions centralized**
⚠️ **No comprehensive testing**
⚠️ **No API documentation**

---

## 🚀 NEXT IMMEDIATE ACTIONS

1. **Start Voting System** (Most critical)
   - Create backend routes & model
   - Create frontend components
   - Integrate with ordinance workflow

2. **Refactor Backend to MVC**
   - Extract logic to controllers
   - Create services layer
   - Add validation middleware

3. **Build Reusable Components**
   - Create Common components folder
   - Extract repeated component logic
   - Create utility functions

4. **Add Testing**
   - Jest for backend
   - React Testing Library for frontend

---

**Total Estimated Lines of Code:** ~18,000+
**Files Count:** 95+ (Backend: 35 | Frontend: 60)
**Overall Completion:** 75%