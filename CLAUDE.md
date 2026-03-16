# Munas Property Manager UI

A Next.js property management application for managing properties, units, tenants, leases, payments, and maintenance records.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand 5
- **HTTP Client**: Axios (with auth interceptors)
- **Date Utilities**: date-fns 4
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Charts**: Recharts

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/           # Public login page
│   └── (dashboard)/            # Protected routes
│       ├── layout.tsx          # Auth guard + sidebar layout
│       ├── dashboard/          # Home/overview
│       ├── properties/[id]/units/[unitId]/
│       ├── tenants/[id]/
│       ├── leasing/[id]/
│       ├── payments/
│       ├── maintenance/
│       ├── users/              # ADMIN only
│       └── settings/
├── components/
│   ├── layout/                 # AppSidebar, Header
│   ├── shared/                 # PageHeader, StatusBadge, StatCard, LoadingState
│   └── ui/                     # shadcn/ui components (do not modify)
├── hooks/
│   └── useEventLogger.ts       # Telemetry hook
├── lib/
│   ├── api/                    # API modules (one file per domain)
│   │   └── client.ts           # Axios instance (baseURL, auth interceptor)
│   ├── formatCurrency.ts       # Intl.NumberFormat wrapper
│   └── utils.ts                # cn() (clsx + tailwind-merge)
├── middleware.ts               # Cookie-based auth guard
├── store/                      # Zustand stores
│   ├── authStore.ts
│   ├── settingsStore.ts
│   └── eventStore.ts
└── types/index.ts              # All shared TypeScript types
```

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:8080   # Backend base URL
```

All API endpoints use the `/api/v1/` prefix.

## Key Conventions

### API Modules (`src/lib/api/*.api.ts`)

Each domain has its own API module exporting a single object:

```ts
export const thingsApi = {
  getAll: async (): Promise<Thing[]> => {
    const { data } = await apiClient.get<Thing[]>('/api/v1/things')
    return data
  },
  getById: async (id: string): Promise<Thing> => { ... },
  create: async (command: CreateThingCommand): Promise<Thing> => { ... },
}
```

Export command types from the same file.

### Page Structure

Every dashboard page follows the same pattern:

```ts
export default function ThingsPage() {
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  const [items, setItems] = useState<Thing[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'things')
    thingsApi.getAll()
      .then(setItems)
      .catch(() => toast.error('Failed to load'))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  ...
}
```

Use `Promise.all` when multiple resources are needed on mount.

### Dates

Always use a `safeFormat` helper — never call `format(new Date(value), ...)` directly, as backend values may be null or invalid:

```ts
function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '—'
  const d = new Date(value)
  return isValid(d) ? format(d, fmt) : '—'
}
```

### Currency

Always use the settings store currency — never use per-record `currencyCode` fields for display:

```ts
const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
// ...
formatCurrency(amount, currency)
```

### Role Gating

```ts
const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
```

Use `canManage` to conditionally render create buttons, action columns, and edit dialogs. `READ_ONLY` users see data but cannot mutate anything.

### Filters and Sorting

Use `useMemo` to compute filtered/sorted lists from raw state. Never mutate the source array:

```ts
const filtered = useMemo(() => {
  const result = [...items].filter(...)
  result.sort(...)
  return result
}, [items, filterA, filterB, sortBy])
```

Always include a Reset button that is only visible when any filter/sort is non-default.

### Optimistic Updates

Used for actions where immediate feedback is important (e.g. unit availability):

1. Snapshot current state
2. Apply update to local state immediately
3. Call API
4. On success: reconcile with server response
5. On failure: restore snapshot and show error toast

### Lookup Maps

When rendering lists that need related data, build maps once rather than searching arrays per row:

```ts
const tenantMap = new Map(tenants.map((t) => [t.id, t]))
const propertyMap = new Map(properties.map((p) => [p.id, p]))
// in render:
const tenant = tenantMap.get(lease.tenantId)
```

### National ID Display

The backend returns `nationalIdNo` already masked (e.g. `***-**-7863`). Use the `maskId` helper for any raw value that needs masking client-side.

### Deep Linking

Use query params to pass pre-population intent across page navigations:

```
/leasing?action=create&propertyId=xxx&unitId=yyy
```

The target page reads params inside the data-fetch `.then()` callback (after data is available), applies state, opens the dialog, then cleans the URL with `router.replace('/leasing')`.

## Auth Flow

1. `middleware.ts` checks for `pm_auth_token` cookie on every request
2. Missing cookie → redirect to `/login`
3. On app mount, `authStore.initialize()` reads token from localStorage
4. If no token: clear stale cookie, set `isLoading: false`
5. If token: call `/api/v1/auth/me`, populate user, fetch settings
6. Dashboard layout redirects to `/login` if `!isAuthenticated && !isLoading`

Token is stored in both localStorage (`pm_auth_token`) and a cookie (for middleware access).

## Stores

| Store | Manages |
|-------|---------|
| `useAuthStore` | `user`, `token`, `isAuthenticated`, `isLoading` — login/logout/initialize |
| `useSettingsStore` | `settings` (currency, theme, timezone) — fetch/update |
| `useEventStore` | In-memory telemetry event log (max 500 events) |

## Types

All shared types live in `src/types/index.ts`. Key entities:

- `User` / `UserRole` (`ADMIN` | `PROPERTY_MANAGER` | `READ_ONLY`)
- `Property` / `PropertyUnit` / `UnavailabilityRecord`
- `Tenant` / `TenantStatus` (`ACTIVE` | `INACTIVE` | `PENDING`)
- `Lease` / `LeaseStatus` (`DRAFT` | `ACTIVE` | `EXPIRED` | `TERMINATED`)
- `Payment` / `PaymentStatus` / `PaymentType`
- `MaintenanceRecord` / `OccupancyRecord`

## Backend Field Notes

These field names have caused confusion — the backend uses:

| Field | Note |
|-------|-------|
| `monthlyRentAmount` | On `PropertyUnit` (not `rentAmount`) |
| `squareFootage` | On `PropertyUnit` (not `squareFeet`) |
| `nationalIdNo` | On `Tenant` (not `nationalId` or `ssn`) — returned pre-masked |
| `leaseStart` / `leaseEnd` | On `OccupancyRecord` (not `startDate`/`endDate`) |
| `leaseId` | Identifier on `OccupancyRecord` (no `id` field) |
| `problemDescription` | On `MaintenanceRecord` (not `title`) |
| `requestedAt` | On `MaintenanceRecord` (not `createdAt`) |
| `completedAt` | On `MaintenanceRecord` (not `resolvedAt`) |
