# adminv2 — User & Record Management Redesign

**Date:** 2026-03-28
**Scope:** New `src/features/adminv2/` module — User Management and Record Management pages
**Approach:** New folder `adminv2` alongside existing admin (V1 routes untouched)

---

## 1. Goals

- Redesign admin User Management and Record Management as production-grade tools
- Fix stale API paths (old `/api/admin/*` → new `/api/user/*`, `/api/cinema/admin/catalog/*`)
- Record management: server-side pagination, filtering, and sorting via backend API
- User management: client-side filtering on a single loaded dataset
- Full responsive support: mobile, tablet, desktop, large monitor
- Consistent tech stack enforced across all adminv2 modules now and in future

---

## 2. Tech Stack (Uniform — No Mixing)

| Concern | Library | Version |
|---|---|---|
| Server state / data fetching | TanStack Query v5 (`@tanstack/react-query`) | new dep |
| Forms + validation | React Hook Form v7 + Zod | `zod` new dep |
| Local UI state | Zustand | already installed |
| Tables | MUI X DataGrid | already installed |
| Notifications | Notistack | already installed |
| Animations | Framer Motion | already installed |
| HTTP | Axios via `adminApi.js` | already installed |
| UI components | MUI v7 + Emotion | already installed |

Every future adminv2 module must use this same stack — no alternatives per module.

---

## 3. Folder Structure

```
src/features/adminv2/
├── api/
│   └── adminApi.js                  # All API calls with correct paths
├── layout/
│   └── AdminLayoutV2.jsx            # Wraps V2 pages, reuses existing sidebar
├── users/
│   ├── index.jsx                    # UserManagementV2 orchestrator
│   ├── UserTable.jsx                # MUI DataGrid, client-side sort/filter
│   ├── UserGrid.jsx                 # Card grid view
│   ├── UserMobileList.jsx           # Mobile-only card list
│   ├── UserFilters.jsx              # Search bar + role filter chips
│   ├── UserEditModal.jsx            # Edit details + password + role
│   ├── UserCreateModal.jsx          # Create single user
│   ├── UserBulkModal.jsx            # Bulk import + bulk delete + bulk role assign
│   └── UserDetailDrawer.jsx        # Read-only detail side panel
└── records/
    ├── index.jsx                    # RecordManagementV2 orchestrator
    ├── RecordTable.jsx              # Server-side paginated MUI DataGrid
    ├── RecordGrid.jsx               # Poster card grid view
    ├── RecordMobileList.jsx         # Mobile-only card list
    ├── RecordFilters.jsx            # Filter bar (name, type, year, tmdbId)
    ├── RecordEditModal.jsx          # Edit record + full tag management
    ├── RecordCreateModal.jsx        # TMDB search → create flow
    ├── RecordTagsInline.jsx         # Inline tag chips in table rows
    └── RecordDetailDrawer.jsx      # Full TMDB metadata side panel
```

---

## 4. Routes

Add to `AdminLayout` sidebar under a "V2" section (or directly replace existing menu items):

| Route | Component | Label |
|---|---|---|
| `/db-world/admin/v2/users` | `UserManagementV2` | User Management |
| `/db-world/admin/v2/records` | `RecordManagementV2` | Records |

V1 routes (`/admin/users`, `/admin/records`) remain untouched.

---

## 5. API Layer (`adminApi.js`)

Single axios wrapper with correct backend paths:

### User APIs
```
GET    /api/user/all                         getAllUsers(pageable?)
POST   /api/user                             createUser(body: CreateUserRequest)
POST   /api/user/bulk                        bulkCreateUsers(body: CreateUserRequest[])
GET    /api/user/{userId}                    getUserById(userId)
PUT    /api/user/{userId}                    updateUser(userId, body: UpdateUserRequest)
PATCH  /api/user/{userId}/role               updateUserRole(userId, roleId)
DELETE /api/user/{userId}                    deleteUser(userId)
PATCH  /api/user/change-password             changePassword(body: ChangePasswordRequest)
GET    /api/user/search                      searchUsers(q, limit)
```

### Record APIs
```
GET    /api/cinema/admin/catalog/table       getRecordsTable(params: RecordAdminFilter + Pageable)
POST   /api/cinema/admin/catalog             createRecord(body: CreateRecordRequest)
PUT    /api/cinema/admin/catalog/{id}        updateRecord(id, body: UpdateRecordRequest)
DELETE /api/cinema/admin/catalog/{id}        deleteRecord(id)
POST   /api/cinema/admin/catalog/{id}/tags   addTag(recordId, body: AddTagRequest)
DELETE /api/cinema/admin/catalog/{id}/tags/{tagType}   removeTag(recordId, tagType)
POST   /api/cinema/admin/catalog/tags/{id}   createTag(recordId, body: RecordTagDto)
PUT    /api/cinema/admin/catalog/tags/{id}   updateTag(tagId, body: RecordTagDto)
DELETE /api/cinema/admin/catalog/tags/{id}   deleteTag(tagId)
```

---

## 6. User Management — Full Feature Spec

### Data Flow
- On mount: `useQuery(['users'], getAllUsers)` — load all users once
- Zustand store holds: `selectedRows`, `viewMode`, `searchTerm`, `roleFilter`, `sortModel`, `drawerUserId`, `modalState`
- Filter/sort applied client-side via `useMemo` on Zustand state

### Page Layout (all breakpoints)

```
[Search]  [Role filter chips: All | Owner | Admin | Viewer]  [View toggle]  [Bulk menu]  [+ Add]
──────────────────────────────────────────────────────────────────────────────────────────────────
[Stats: Total N | Admins N | Viewers N | Selected N (when > 0)]
──────────────────────────────────────────────────────────────────────────────────────────────────
[Table / Grid / Mobile list — based on breakpoint + toggle]
```

### Responsive Behaviour

| Breakpoint | View | Notes |
|---|---|---|
| Mobile (< 600px) | `UserMobileList` only | Table/Grid hidden. FAB bottom-right for create. Filters → bottom sheet. Bulk actions → bottom action bar. Modals → full-screen. |
| Tablet (600–960px) | Table (reduced cols) or Grid (2 col) | Columns: Name, Role, Email, Actions. Modal centered full-width. |
| Desktop (960–1440px) | Full table or Grid (3–4 col) | All columns. Detail drawer slides from right. Modal centered. |
| Monitor (> 1440px) | Full table or Grid (5–6 col) | Wide layout, detail drawer persistent side panel option. |

### Table Columns (Desktop)
| Column | Sortable | Notes |
|---|---|---|
| ☐ | — | Row select checkbox |
| Name | ✓ | firstName + lastName |
| Email | ✓ | — |
| Mobile | — | formatted |
| Role | ✓ | Color-coded badge |
| Login Count | ✓ | — |
| Last Login | ✓ | Relative time |
| Actions | — | View · Edit · Role toggle · Delete |

### Inline Row Actions
- **View** → opens `UserDetailDrawer` (read-only, login history, cinema data)
- **Edit** → opens `UserEditModal` (update details + password + role)
- **Role toggle** → quick chip click → `PATCH /api/user/{id}/role` (with optimistic update)
- **Delete** → confirmation popover → `DELETE /api/user/{id}`

### Bulk Operations (`UserBulkModal`)
Activated when 1+ rows selected. Toolbar appears above table:
- **Delete selected** — confirm → fire DELETE for each, invalidate query
- **Assign role** — dropdown → confirm → fire PATCH role for each
- **Import** (tab) — CSV or JSON paste → preview table → bulk POST

### Forms & Validation (Zod schemas)

**CreateUserRequest schema:**
```
firstName: string min(2) max(20)
lastName:  string min(1) max(20)
dob:       date (yyyy-MM-dd)
gender:    string non-empty
mobileNo:  number (999999999–9999999999, matches backend @Min/@Max)
email:     email
password:  string min(6) max(100)
roleId:    number optional
```

**UpdateUserRequest schema:**
```
firstName, lastName, dob, gender, mobileNo, password (same rules, no email)
```

---

## 7. Record Management — Full Feature Spec

### Data Flow
- Every filter/sort/page change fires: `useQuery(['records', filters, page, sort], getRecordsTable)`
- TanStack Query `keepPreviousData: true` for smooth pagination
- Zustand store holds: `filters`, `page`, `pageSize`, `sortModel`, `viewMode`, `selectedRows`, `drawerRecordId`, `modalState`
- Tag mutations fire immediately with optimistic update + rollback on error

### Page Layout

```
[Search: name]  [Type: All·Movie·Series]  [Year]  [TMDB ID]  [View toggle]  [Clear filters]  [+ Add]
──────────────────────────────────────────────────────────────────────────────────────────────────────
[Stats: Total N | Movies N | Series N | Filtered N]
──────────────────────────────────────────────────────────────────────────────────────────────────────
[Table / Grid / Mobile list — server paginated]
```

### Responsive Behaviour

| Breakpoint | View | Notes |
|---|---|---|
| Mobile (< 600px) | `RecordMobileList` only | Poster thumbnail, name, type badge, tags. FAB for create. Filters → bottom sheet. |
| Tablet (600–960px) | Table (reduced cols) or Grid (2–3 col) | Columns: Name, Type, Year, Tags, Actions. |
| Desktop (960–1440px) | Full table or Grid (3–4 col) | All 7 sortable columns. Detail drawer from right. |
| Monitor (> 1440px) | Full table or Grid (5–6 col) | Wide detail drawer. |

### Table Columns (Desktop) — All server-sortable
| Column | Sort param | Notes |
|---|---|---|
| ID | `recordId` | — |
| Name | `name` | — |
| Type | `type` | Movie / Series badge |
| Year | `year` | — |
| TMDB ID | `tmdbId` | Link to TMDB |
| Tags | — | Inline chips + `+` add button (`RecordTagsInline`) |
| Created | `createdAt` | Relative time |
| Updated | `updatedAt` | Relative time |
| Actions | — | View · Edit · Delete |

### Tag Management
- **Inline (table + card):** Tag chips shown directly on row. `×` removes tag immediately (optimistic). `+` button opens tag-type picker popover.
- **In edit modal:** Full tag section — list of all current tags with type, priority, created date. Add new tag with type + priority. Reorder by priority. Remove any tag.
- Tag types: `FEATURED`, `NEW_RELEASE`, `TRENDING`, `EDITOR_PICK`, `SHOW_ON_TOP`, `RECENTLY_ADDED`, `TOP_10`

### Record Create Flow (`RecordCreateModal`)
1. Select type: Movie or Series
2. Search TMDB by title (debounced, calls TMDB search API)
3. Results shown as poster cards (title, year, rating, overview snippet)
4. Select one → confirm → `POST /api/cinema/admin/catalog`
5. Success → toast + table refetch

### Forms & Validation (Zod)

**CreateRecordRequest schema:**
```
type:   enum(['MOVIE', 'SERIES'])
tmdbId: number positive integer
```

**UpdateRecordRequest schema:** same as create

---

## 8. Shared Patterns

### Loading States
- Table: MUI DataGrid skeleton rows (built-in)
- Grid: Skeleton card grid (MUI Skeleton)
- Modals: Skeleton form fields while fetching existing data

### Error States
- TanStack Query `error` state → inline error banner with retry button
- Mutations: Notistack `enqueueSnackbar` for success (green) and error (red)

### Optimistic Updates
- Tag add/remove on records: update Zustand cache immediately, rollback on API error
- Role toggle on users: update local list immediately, rollback on error

### Empty States
- No data: illustration + message + CTA ("Add your first record")
- No search results: illustration + "No results for X" + Clear filters button

### Accessibility
- All modals trap focus, `aria-labelledby`, `aria-describedby`
- DataGrid: keyboard navigation, screen reader column headers
- Touch targets minimum 48×48px on mobile
- Color is never the only indicator (badges have text labels too)

---

## 9. What Does NOT Change

- `src/features/admin/` (V1) — untouched, all routes preserved
- `src/shared/services/ApiServices.js` — not modified
- `AdminLayout.jsx` — only adds new nav items for V2 routes
- Backend — no changes required

---

## 10. New Dependencies

```bash
npm install @tanstack/react-query zod
```

`QueryClientProvider` wraps the app in `src/app/App.jsx` so the query cache is shared across the whole app (devtools also available in development via `ReactQueryDevtools`).
