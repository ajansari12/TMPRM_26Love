# TPRMV2026 -- OSFI B-10 Third-Party Risk Management

Enterprise third-party risk management platform built for OSFI B-10 regulatory compliance in Canadian financial institutions.

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS 3
- **State:** TanStack Query (server state), React Context (auth)
- **Routing:** React Router 7
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Export:** jsPDF, PptxGenJS
- **Build:** Vite 5
- **Testing:** Vitest, React Testing Library

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Supabase project (for backend)

### Installation

```bash
git clone <repo-url>
cd tprmv2026
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
src/
├── app/                  # Application shell (App.tsx, providers, entry point)
├── features/             # Feature-based modules
│   ├── admin/            # Settings, audit log
│   ├── assessments/      # Tiering assessments, risk matrix
│   ├── attestations/     # Attestation management
│   ├── auth/             # Login, register, auth context
│   ├── contracts/        # Contract register, reviews
│   ├── dashboard/        # Main dashboard
│   ├── due-diligence/    # Due diligence tracking
│   ├── incidents/        # Incident reporting
│   ├── monitoring/       # KRI, concentration, performance
│   ├── reports/          # Board and inventory reports
│   └── vendors/          # Vendor management (CRUD, documents)
├── shared/               # Shared across features
│   ├── components/       # Reusable UI components
│   │   ├── data-display/ # StatusBadge, TierBadge
│   │   ├── feedback/     # ErrorFallback, Toast
│   │   ├── layout/       # Layout, ProtectedRoute
│   │   └── ui/           # Badge, Button, SearchInput, etc.
│   ├── hooks/            # Shared custom hooks
│   ├── lib/              # Utilities, Supabase client, constants
│   └── types/            # TypeScript type definitions
├── test/                 # Test utilities and setup
└── supabase/             # Database migrations and edge functions
```

## Key Features

- **Vendor Management** -- Full lifecycle tracking with tiered risk assessment
- **Risk Assessment Wizard** -- OSFI B-10 compliant questionnaire with automated scoring
- **Contract Management** -- Contract register with legal review workflow
- **Incident Tracking** -- With OSFI regulatory notification support
- **KRI Monitoring** -- Key Risk Indicators with threshold-based alerts
- **Concentration Risk** -- Vendor dependency analysis
- **Attestations** -- Periodic compliance confirmation workflow
- **Board Reporting** -- Export to PDF, PowerPoint, Excel
- **Audit Trail** -- Full activity logging
- **Role-Based Access** -- 6 user roles with Supabase RLS

## Architecture

- **Feature-based folders** -- Each domain is self-contained with pages, components, hooks, services, and schemas
- **Service layer** -- API calls abstracted into `*.api.ts` service files
- **TanStack Query** -- Server state management with caching, auto-refetching, and optimistic updates
- **Error boundaries** -- App-level and layout-level error boundaries with toast notifications
- **Code splitting** -- All 23 pages lazy-loaded with React.lazy + Suspense
- **Zod validation** -- Schema-based form validation with React Hook Form
