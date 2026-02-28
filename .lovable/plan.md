

# TPRM V2026 — OSFI B-10 Third-Party Risk Management Platform

An enterprise third-party risk management platform built for OSFI B-10 regulatory compliance, using Lovable Cloud (Supabase) for authentication, database, and edge functions.

---

## Phase 1: Foundation & Authentication

### 1. App Shell & Navigation
- Sidebar layout with collapsible navigation
- Top bar with user avatar, notifications bell, and search
- Navigation groups: Dashboard, Vendors, Assessments, Contracts, Monitoring, Incidents, Reports, Admin
- Responsive design with mobile hamburger menu

### 2. Authentication (Lovable Cloud)
- Login page with email/password
- User registration with role assignment
- Password reset flow
- Auth context with protected routes
- 6 user roles: Admin, Risk Manager, Compliance Officer, Business Owner, Auditor, Read-Only

### 3. User Profiles & Role-Based Access
- Profiles table linked to auth.users
- Role-based navigation (hide menu items based on role)
- Row-Level Security policies on all tables

---

## Phase 2: Core Data — Vendors

### 4. Vendor Management
- Vendor list page with search, filter by status/tier/category
- Add/Edit vendor form (name, category, contact info, criticality, status)
- Vendor detail page with tabs: Overview, Documents, Assessments, Contracts, Incidents
- Vendor document upload and management (Lovable Cloud Storage)
- Status workflow: Prospect → Active → Under Review → Offboarded

---

## Phase 3: Risk Assessment

### 5. Risk Assessment Wizard
- Multi-step tiering questionnaire based on OSFI B-10 criteria
- Automated risk scoring algorithm (Critical, High, Medium, Low)
- Risk matrix visualization
- Assessment history per vendor
- Tier badges displayed throughout the app

### 6. Due Diligence Tracking
- Due diligence checklist per vendor (financial, operational, cyber, compliance)
- Status tracking (Not Started, In Progress, Complete, Overdue)
- Document attachment for evidence

---

## Phase 4: Contracts & Compliance

### 7. Contract Management
- Contract register with list/detail views
- Fields: vendor, start/end dates, value, renewal terms, SLAs
- Legal review workflow with approval status
- Renewal alerts and expiry tracking

### 8. Attestation Management
- Periodic compliance confirmation workflows
- Attestation templates and scheduling
- Status tracking and reminder notifications

---

## Phase 5: Monitoring & Incidents

### 9. KRI Monitoring (Key Risk Indicators)
- KRI dashboard with threshold-based alerts (green/amber/red)
- Charts showing KRI trends over time (Recharts)
- Configurable thresholds per vendor tier

### 10. Concentration Risk Analysis
- Vendor dependency analysis dashboard
- Visualizations showing concentration by category, geography, revenue
- Alerts when concentration exceeds thresholds

### 11. Performance Monitoring
- Vendor performance scorecards
- SLA compliance tracking
- Performance trend charts

### 12. Incident Reporting
- Incident log with severity levels
- OSFI regulatory notification tracking
- Incident detail with timeline and resolution tracking
- Link incidents to vendors

---

## Phase 6: Reporting & Admin

### 13. Board Reporting
- Pre-built board report templates
- Export to PDF (jsPDF) and PowerPoint (PptxGenJS)
- Summary dashboards with key metrics and charts

### 14. Inventory Reports
- Full vendor inventory export
- Filterable report builder
- Export to Excel/CSV

### 15. Main Dashboard
- Executive summary with key metrics cards
- Risk distribution chart
- Upcoming renewals and overdue items
- Recent activity feed
- Quick-action buttons

### 16. Admin & Settings
- User management (invite, role assignment, deactivate)
- Audit trail / activity log
- System settings and configuration

---

## Database Schema (Lovable Cloud)
Tables: profiles, vendors, assessments, contracts, due_diligence, incidents, kri_metrics, attestations, documents, audit_log, concentration_data — all with RLS policies.

