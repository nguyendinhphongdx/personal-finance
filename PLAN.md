# Personal Finance & Rental Management App - Implementation Plan

## Context
Build a personal finance app with 3 core features: income/expense tracking, rental house management (with monthly billing snapshots), and a unified dashboard. The user rents a 4-floor house and sublets rooms - needs to track profit from electricity markup and manage tenants/contracts.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS + Lucide icons
- **State**: Zustand
- **DB**: Neon PostgreSQL (free) + Prisma ORM
- **Auth**: NextAuth.js v5 (credentials)
- **Charts**: Recharts
- **Font**: Plus Jakarta Sans
- **Design**: Glassmorphism, dark/light mode, Vietnamese UI

## Architecture (Service Layer - easy to separate BE later)

```
src/
├── app/
│   ├── api/                    # Thin API route handlers
│   │   ├── auth/[...nextauth]/ # Auth
│   │   ├── transactions/       # Thu chi CRUD
│   │   ├── categories/         # Danh mục
│   │   ├── budgets/            # Hạn mức
│   │   ├── rooms/              # Phòng
│   │   ├── tenants/            # Người thuê
│   │   ├── billing/            # Hóa đơn hàng tháng
│   │   └── dashboard/          # Stats
│   ├── (auth)/                 # Public: login, register
│   │   ├── login/
│   │   └── register/
│   └── (dashboard)/            # Protected layout with sidebar
│       ├── page.tsx            # Dashboard
│       ├── transactions/       # Thu chi
│       ├── rental/             # Quản lý nhà
│       │   ├── rooms/          # Cấu hình phòng
│       │   ├── tenants/        # Người ở
│       │   ├── contracts/      # Hợp đồng
│       │   └── billing/        # Chốt sổ hàng tháng
│       └── settings/           # Cài đặt
├── lib/
│   ├── services/               # Business logic (portable)
│   │   ├── transaction.service.ts
│   │   ├── billing.service.ts
│   │   ├── room.service.ts
│   │   └── dashboard.service.ts
│   ├── repositories/           # Data access (Prisma)
│   │   ├── transaction.repo.ts
│   │   ├── billing.repo.ts
│   │   └── room.repo.ts
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config
│   └── utils.ts
├── stores/                     # Zustand stores
│   ├── transaction.store.ts
│   ├── rental.store.ts
│   └── ui.store.ts
├── components/
│   ├── ui/                     # shadcn components
│   ├── layout/                 # Sidebar, Header, ThemeToggle
│   ├── transactions/           # Transaction-specific components
│   ├── rental/                 # Rental-specific components
│   ├── dashboard/              # Dashboard widgets
│   └── shared/                 # Reusable: DatePicker, FileUpload...
└── types/                      # Shared TypeScript types
```

## Database Schema (Prisma)

```prisma
// Auth
model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  password      String   // bcrypt hashed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Thu Chi
model Category {
  id       String   @id @default(cuid())
  name     String
  type     TransactionType // INCOME | EXPENSE
  icon     String?
  color    String?
  isDefault Boolean @default(false)
  userId   String
  budgets  Budget[]
  transactions Transaction[]
}

model Transaction {
  id          String   @id @default(cuid())
  amount      Float
  type        TransactionType
  description String?
  date        DateTime
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  userId      String
  createdAt   DateTime @default(now())
}

model Budget {
  id         String @id @default(cuid())
  amount     Float
  month      Int
  year       Int
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  userId     String
  @@unique([categoryId, month, year])
}

// Rental
model Room {
  id           String   @id @default(cuid())
  name         String   // e.g. "Phòng 301"
  floor        Int
  price        Float    // Giá phòng
  isActive     Boolean  @default(true)
  userId       String
  tenants      Tenant[]
  contracts    Contract[]
  billingItems BillingItem[]
}

model Tenant {
  id          String   @id @default(cuid())
  name        String
  phone       String?
  idNumber    String?  // CCCD
  isFamily    Boolean  @default(false) // Flag cho em gái
  moveInDate  DateTime
  moveOutDate DateTime?
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id])
  userId      String
}

model Contract {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  startDate DateTime
  endDate   DateTime?
  fileUrl   String   // Uploaded file path
  fileName  String
  userId    String
  createdAt DateTime @default(now())
}

// Fee Configuration (flexible - add/edit/delete fee types)
model FeeType {
  id            String   @id @default(cuid())
  name          String   // e.g. "Tiền điện", "Tiền nước", "Tiền mạng"
  unit          String?  // e.g. "kWh", "người", null (fixed)
  calcMode      CalcMode // PER_UNIT, PER_PERSON, FIXED
  defaultPrice  Float    // e.g. 4000 (per kWh), 50000 (per person), 50000 (fixed)
  isDefault     Boolean  @default(false) // Pre-configured defaults
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)
  userId        String
  createdAt     DateTime @default(now())
}

enum CalcMode {
  PER_UNIT    // Nhập số lượng × đơn giá (e.g. điện: units × 4000)
  PER_PERSON  // Số người × đơn giá (e.g. nước: people × 50k)
  FIXED       // Cố định / phòng (e.g. mạng: 50k/phòng)
}

// Billing (snapshot-based)
model BillingPeriod {
  id                  String   @id @default(cuid())
  month               Int
  year                Int
  isLocked            Boolean  @default(false)
  actualElectricBill  Float?   // Hóa đơn điện thực tế cả nhà
  landlordPayment     Float?   // Tiền gửi chủ nhà
  totalCollected      Float?   // Tổng thu thực tế
  notes               String?
  userId              String
  items               BillingItem[]
  lockedAt            DateTime?
  createdAt           DateTime @default(now())
  @@unique([month, year, userId])
}

model BillingItem {
  id                String   @id @default(cuid())
  billingPeriodId   String
  billingPeriod     BillingPeriod @relation(fields: [billingPeriodId], references: [id])
  roomId            String
  room              Room     @relation(fields: [roomId], references: [id])
  // Snapshot data (frozen at lock time)
  snapshotRoomName  String
  snapshotFloor     Int
  snapshotPrice     Float    // Giá phòng tại thời điểm chốt
  snapshotTenants   Json     // [{name, isFamily}] frozen
  snapshotNumPeople Int
  // Fee details (snapshot of all fees at lock time)
  fees              BillingItemFee[]
  totalAmount       Float    @default(0)  // roomPrice + sum(all fees)
  isPaid            Boolean  @default(false)
  paidAt            DateTime?
}

// Each fee line in a room's bill (snapshot - immutable after lock)
model BillingItemFee {
  id              String   @id @default(cuid())
  billingItemId   String
  billingItem     BillingItem @relation(fields: [billingItemId], references: [id])
  // Snapshot of fee config at lock time
  feeName         String   // "Tiền điện"
  calcMode        CalcMode
  unitPrice       Float    // 4000
  quantity        Float    // units entered or numPeople or 1
  amount          Float    // unitPrice × quantity
}

enum TransactionType {
  INCOME
  EXPENSE
}
```

## Implementation Phases

### Phase 1: Project Setup & Auth
1. Init Next.js 15, Tailwind, shadcn/ui
2. Setup Prisma + Neon connection
3. NextAuth.js with credentials (register/login)
4. Dashboard layout (sidebar, header, theme toggle)
5. Middleware auth protection

### Phase 2: Thu Chi (Transactions)
1. Categories CRUD (with defaults: Lương, Ăn uống, Di chuyển, etc.)
2. Transactions CRUD with filters
3. Budget limits per category
4. Charts: line (trend), donut (by category), bar (comparison)

### Phase 3: Rental Management
1. **Fee Types CRUD** - Cấu hình loại phí (defaults: Điện, Nước, Mạng) + thêm/sửa/xóa
2. Room configuration (CRUD rooms with floor/price)
3. Tenant management (CRUD, assign to rooms)
4. Contract upload & preview
5. **Billing UI per room per month:**
   - Select tháng → hiện tất cả phòng
   - Mỗi phòng = 1 card/row hiện: tên phòng, người ở, giá phòng
   - Bên dưới: danh sách các loại phí đã cấu hình
     - PER_UNIT (điện): input số lượng → auto tính = quantity × unitPrice
     - PER_PERSON (nước): auto lấy số người → auto tính
     - FIXED (mạng): auto tính = unitPrice
   - Tổng cộng = giá phòng + tổng phí
   - Nút "Đã thanh toán" toggle
6. **Bill Preview UI** - Hiện hóa đơn đẹp cho từng phòng (có thể in/share)
7. **Lock/Unlock** - Chốt sổ snapshot toàn bộ, sau đó immutable
8. Billing summary: tổng thu - chủ nhà - điện thực tế = lợi nhuận

### Phase 4: Dashboard
1. Overview stat cards
2. Multi-period selector (week/month/quarter/year)
3. Combined charts (personal + rental)
4. Recent activity feed

## Bill UI Detail (Hóa đơn phòng)

### Fee Types Config Page (`/rental/fee-types`)
```
┌─────────────────────────────────────────────────┐
│  Cấu hình loại phí                    [+ Thêm] │
├──────────┬──────────┬──────────┬────────┬───────┤
│ Tên phí  │ Loại     │ Đơn giá  │ Đơn vị │       │
├──────────┼──────────┼──────────┼────────┼───────┤
│ Tiền điện│ Theo SL  │ 4,000đ   │ kWh    │ ✏️ 🗑 │
│ Tiền nước│ Theo người│ 50,000đ │ người  │ ✏️ 🗑 │
│ Tiền mạng│ Cố định  │ 50,000đ  │ —      │ ✏️ 🗑 │
│ Rác      │ Cố định  │ 20,000đ  │ —      │ ✏️ 🗑 │
└──────────┴──────────┴──────────┴────────┴───────┘
```

### Monthly Billing Page (`/rental/billing`)
```
┌─────────────────────────────────────────────────┐
│  Hóa đơn tháng  [◀ T3/2026 ▶]     [🔒 Chốt sổ]│
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Phòng 201 (Tầng 2) ── Nguyễn Văn A ──────┐│
│  │  Tiền phòng:              2,500,000đ        ││
│  │  ─────────────────────────────────────       ││
│  │  Tiền điện:  [___120] kWh × 4,000 = 480,000 ││
│  │  Tiền nước:  2 người × 50,000    = 100,000  ││
│  │  Tiền mạng:  1 phòng × 50,000    =  50,000  ││
│  │  ─────────────────────────────────────       ││
│  │  TỔNG CỘNG:                     3,130,000đ  ││
│  │                    [☐ Đã thanh toán] [🧾 Xem]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Phòng 301 (Tầng 3) ── Trần Thị B ────────┐│
│  │  ...                                        ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ╔══════════════════════════════════════════════╗│
│  ║  TỔNG KẾT THÁNG                             ║│
│  ║  Tổng thu từ phòng:         12,500,000đ     ║│
│  ║  Tiền gửi chủ nhà:    [-__8,000,000đ]      ║│
│  ║  Hóa đơn điện thực tế:[-__1,200,000đ]      ║│
│  ║  ────────────────────────────────────        ║│
│  ║  LỢI NHUẬN:                  3,300,000đ     ║│
│  ╚══════════════════════════════════════════════╝│
└─────────────────────────────────────────────────┘
```

### Bill Preview (Dialog/Print)
```
┌─────────────────────────────────────┐
│         HÓA ĐƠN PHÒNG 201         │
│         Tháng 03/2026              │
│─────────────────────────────────────│
│ Người ở: Nguyễn Văn A, Lê Thị C   │
│ Tầng: 2                            │
│─────────────────────────────────────│
│ Tiền phòng          2,500,000đ     │
│ Tiền điện (120 kWh)   480,000đ     │
│ Tiền nước (2 người)   100,000đ     │
│ Tiền mạng              50,000đ     │
│─────────────────────────────────────│
│ TỔNG CỘNG           3,130,000đ     │
│                                     │
│ Trạng thái: ✅ Đã thanh toán       │
│              [🖨 In] [📤 Chia sẻ]   │
└─────────────────────────────────────┘
```

## API Pattern (all routes follow this)
```
API Route (thin) → Service (business logic) → Repository (Prisma)
```
This makes future BE separation trivial: just move services + repos to Express/Fastify.

## UX Guidelines
- **Info tooltips**: Tất cả label/field phức tạp đều có icon ℹ️ (Lucide `Info` icon) kèm tooltip mô tả. Dùng shadcn `Tooltip` component.
  - VD: "Theo số lượng" ℹ️ → hover → "Nhập số lượng sử dụng, hệ thống tự nhân với đơn giá"
  - VD: "Chốt sổ" ℹ️ → hover → "Sau khi chốt, dữ liệu hóa đơn sẽ được khóa và không thể chỉnh sửa"
  - VD: CalcMode labels: PER_UNIT ℹ️, PER_PERSON ℹ️, FIXED ℹ️ đều có tooltip giải thích
- Áp dụng cho: form labels, table headers, stat cards, buttons có hành động quan trọng (lock/delete)

## Verification
1. `npm run build` - no errors
2. Register/login flow works
3. CRUD transactions with chart rendering
4. Create rooms, add tenants, run billing cycle, lock period
5. Dashboard shows combined stats
6. Dark/light mode toggle
7. Responsive on mobile (375px+)
