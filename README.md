# Munas Property Manager UI

A modern, full-featured property management web application built with Next.js. Manage properties, rental units, tenants, leases, payments, and maintenance records through a clean, role-aware interface.

---

## Features

- **Properties** — Create and manage properties with multiple rental units. Track availability, mark units unavailable, view unit details and occupancy history.
- **Tenants** — Register tenants, view contact details, manage activation status, and track national ID and credit score.
- **Leasing** — Create and manage lease agreements. Filter by status, property, and duration. Sort by start/end date. Deep-link from a unit card to pre-populate a new lease.
- **Payments** — Track rent, deposits, fees, and other payment types. Filter by status and property. Sort by due or paid date. Record incoming payments.
- **Maintenance** — View and manage maintenance requests per tenant and unit.
- **Users** — Manage application users and roles (Admin only).
- **Settings** — Configure display currency, theme (light/dark), and timezone per user.
- **Dashboard** — Overview of key stats, recent leases, and recent payments with clickable rows.

### Role-Based Access

| Role | Capabilities |
|------|-------------|
| `ADMIN` | Full access — manage users, all CRUD operations |
| `PROPERTY_MANAGER` | Create and manage properties, tenants, leases, payments |
| `READ_ONLY` | View-only access across all sections |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI) |
| State | Zustand 5 |
| HTTP | Axios |
| Dates | date-fns 4 |
| Icons | Lucide React |
| Toasts | Sonner |
| Charts | Recharts |
| Auth | jose (JWT) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A running instance of the Munas Property Manager API (default: `http://localhost:8080`)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                        # Root layout with providers
│   ├── page.tsx                          # Redirects to /dashboard
│   ├── (auth)/
│   │   └── login/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx                    # Auth guard + sidebar layout
│       ├── dashboard/page.tsx            # Overview / home
│       ├── properties/
│       │   ├── page.tsx                  # Properties list
│       │   └── [id]/
│       │       ├── page.tsx              # Property detail with unit cards
│       │       └── units/[unitId]/page.tsx
│       ├── tenants/
│       │   ├── page.tsx                  # Tenants list
│       │   └── [id]/page.tsx             # Tenant detail
│       ├── leasing/
│       │   ├── page.tsx                  # Leases list with filters
│       │   └── [id]/page.tsx             # Lease detail
│       ├── payments/page.tsx             # Payments list with filters
│       ├── maintenance/page.tsx
│       ├── users/page.tsx                # Admin only
│       └── settings/page.tsx
├── components/
│   ├── layout/                           # AppSidebar, Header
│   ├── shared/                           # PageHeader, StatusBadge, StatCard, LoadingState
│   └── ui/                              # shadcn/ui components
├── hooks/
│   └── useEventLogger.ts
├── lib/
│   ├── api/                             # One module per domain
│   │   ├── client.ts                    # Axios instance + interceptors
│   │   ├── auth.api.ts
│   │   ├── properties.api.ts
│   │   ├── tenants.api.ts
│   │   ├── leases.api.ts
│   │   ├── payments.api.ts
│   │   ├── maintenance.api.ts
│   │   ├── occupancy.api.ts
│   │   ├── settings.api.ts
│   │   └── users.api.ts
│   ├── formatCurrency.ts
│   └── utils.ts                         # cn() utility
├── middleware.ts                        # Cookie-based auth guard
├── store/
│   ├── authStore.ts                     # Auth state + initialize/login/logout
│   ├── settingsStore.ts                 # User preferences (currency, theme)
│   └── eventStore.ts                   # In-memory telemetry log
└── types/index.ts                       # All shared TypeScript types
```

---

## Authentication

Authentication is token-based (JWT stored in `localStorage` and a cookie).

**Flow:**
1. `middleware.ts` checks the `pm_auth_token` cookie on every request — unauthenticated requests are redirected to `/login`
2. On app mount, `authStore.initialize()` reads the token from `localStorage` and validates it against `/api/v1/auth/me`
3. The dashboard layout waits for `isLoading` to resolve before redirecting unauthenticated users

**Token key:** `pm_auth_token`

---

## API

All backend requests use the base URL from `NEXT_PUBLIC_API_URL` and the `/api/v1/` prefix.

The Axios client (`src/lib/api/client.ts`) automatically:
- Attaches `Authorization: Bearer {token}` to every request
- Handles `401` responses by clearing the token and redirecting to `/login`

### Endpoints Used

| Domain | Base Path |
|--------|-----------|
| Auth | `/api/v1/auth` |
| Properties | `/api/v1/properties` |
| Units | `/api/v1/units` |
| Tenants | `/api/v1/tenants` |
| Leases | `/api/v1/leases` |
| Payments | `/api/v1/payments` |
| Maintenance | `/api/v1/maintenance` |
| Occupancy | `/api/v1/occupancy` |
| Settings | `/api/v1/settings` |
| Users | `/api/v1/users` |

---

## State Management

Three Zustand stores:

| Store | Responsibility |
|-------|---------------|
| `useAuthStore` | Current user, token, `isAuthenticated`, `isLoading` |
| `useSettingsStore` | User preferences — currency, theme, timezone |
| `useEventStore` | In-memory telemetry event log (capped at 500 events) |

---

## Key Types

Defined in `src/types/index.ts`:

```ts
UserRole      = 'ADMIN' | 'PROPERTY_MANAGER' | 'READ_ONLY'
TenantStatus  = 'ACTIVE' | 'INACTIVE' | 'PENDING'
LeaseStatus   = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID' | 'CANCELLED'
PaymentType   = 'RENT' | 'SECURITY_DEPOSIT' | 'LATE_FEE' | 'MAINTENANCE_FEE' | 'OTHER'
PropertyType  = 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'CONDO' | 'TOWNHOUSE' | 'STUDIO'
```

---

## Available Scripts

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
```
