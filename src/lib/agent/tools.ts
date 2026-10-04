import { tool } from "langchain";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/request-context";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import { matchCategory } from "@/lib/voice-parser";
import { transactionService } from "@/lib/services/transaction.service";
import { billingService } from "@/lib/services/billing.service";
import { dashboardService } from "@/lib/services/dashboard.service";
import { propertyService } from "@/lib/services/property.service";
import { roomRepo, tenantRepo, roomAssignmentRepo, feeTypeRepo } from "@/lib/repositories/room.repo";
import { assertOwnsProperty } from "@/lib/repositories/ownership";

// Every tool reads the current user via getUserId() inside the repos/services, so the
// model can never choose whose data it touches. The route must run the agent inside
// withUserContext(). Tools never take a userId argument.

/** Result every tool returns to the model (JSON-encoded) and that the route turns into UI chips. */
export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
}

/** Tools that change data. The UI highlights these so the user can see what was done. */
export const WRITE_TOOLS = new Set<string>();

function define<S extends z.ZodObject>(
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<S>) => Promise<{ summary: string; data?: unknown }>,
  opts: { write?: boolean } = {}
) {
  if (opts.write) WRITE_TOOLS.add(name);
  return tool(
    async (args: z.infer<S>) => {
      let result: ToolResult;
      try {
        result = { ok: true, ...(await handler(args)) };
      } catch (err) {
        const known = err instanceof NotFoundError || err instanceof BadRequestError;
        if (!known) console.error(`[agent tool ${name}]`, err);
        result = { ok: false, summary: known ? err.message : "Lỗi hệ thống khi thực hiện thao tác" };
      }
      return JSON.stringify(result);
    },
    { name, description, schema }
  );
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD");
const calcModeSchema = z.enum(["PER_UNIT", "PER_PERSON", "FIXED"]);

async function resolveCategoryId(name: string, type: "INCOME" | "EXPENSE") {
  const userId = getUserId();
  const categories = await prisma.category.findMany({ where: { userId } });
  const id = matchCategory(name, categories, type);
  if (id) return { id, created: false };
  const created = await prisma.category.create({ data: { name, type, userId } });
  return { id: created.id, created: true };
}

// ==================== CATEGORIES ====================

const listCategories = define(
  "list_categories",
  "Liệt kê danh mục thu/chi của người dùng.",
  z.object({ type: z.enum(["INCOME", "EXPENSE"]).optional() }),
  async ({ type }) => {
    const data = await prisma.category.findMany({
      where: { userId: getUserId(), ...(type && { type }) },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });
    return { summary: `${data.length} danh mục`, data };
  }
);

const createCategory = define(
  "create_category",
  "Tạo danh mục thu/chi mới.",
  z.object({ name: z.string().min(1), type: z.enum(["INCOME", "EXPENSE"]) }),
  async ({ name, type }) => {
    const data = await prisma.category.create({ data: { name, type, userId: getUserId() } });
    return { summary: `Đã tạo danh mục "${name}"`, data: { id: data.id } };
  },
  { write: true }
);

// ==================== TRANSACTIONS ====================

const listTransactions = define(
  "list_transactions",
  "Liệt kê giao dịch thu/chi cá nhân, mới nhất trước. Lọc theo khoảng ngày và loại.",
  z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    limit: z.number().int().min(1).max(100).optional().describe("Mặc định 20"),
  }),
  async ({ startDate, endDate, type, limit }) => {
    const all = await transactionService.getAll({ startDate, endDate, type });
    const data = all.slice(0, limit ?? 20).map((t) => ({
      id: t.id, date: ymd(t.date), type: t.type, amount: t.amount, description: t.description, category: t.category.name,
    }));
    return { summary: `${all.length} giao dịch`, data };
  }
);

const createTransaction = define(
  "create_transaction",
  "Ghi một giao dịch thu/chi cá nhân. categoryName là tên danh mục (VD: Ăn uống, Di chuyển, Lương); tự tạo danh mục nếu chưa có.",
  z.object({
    amount: z.number().positive().describe("Số tiền VND"),
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().optional(),
    date: dateSchema.optional().describe("Mặc định hôm nay"),
    categoryName: z.string().min(1),
  }),
  async ({ amount, type, description, date, categoryName }) => {
    const category = await resolveCategoryId(categoryName, type);
    const tx = await transactionService.create({
      amount, type, description, categoryId: category.id, date: date ?? ymd(new Date()),
    });
    const sign = type === "EXPENSE" ? "−" : "+";
    return {
      summary: `Đã ghi ${type === "EXPENSE" ? "chi" : "thu"}: ${description || tx.category.name} ${sign}${formatCurrency(amount)}`
        + (category.created ? ` (tạo danh mục "${categoryName}")` : ""),
      data: { id: tx.id },
    };
  },
  { write: true }
);

const updateTransaction = define(
  "update_transaction",
  "Sửa một giao dịch đã có (lấy id từ list_transactions). Chỉ truyền các trường cần đổi.",
  z.object({
    id: z.string(),
    amount: z.number().positive().optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    description: z.string().optional(),
    date: dateSchema.optional(),
    categoryName: z.string().optional(),
  }),
  async ({ id, categoryName, ...rest }) => {
    let categoryId: string | undefined;
    if (categoryName) {
      const current = await prisma.transaction.findFirst({ where: { id, userId: getUserId() } });
      if (!current) throw new NotFoundError("Không tìm thấy giao dịch");
      categoryId = (await resolveCategoryId(categoryName, rest.type ?? current.type)).id;
    }
    const tx = await transactionService.update(id, { ...rest, categoryId });
    return { summary: `Đã sửa giao dịch: ${tx.description || tx.category.name} ${formatCurrency(tx.amount)}`, data: { id } };
  },
  { write: true }
);

// ==================== PROPERTIES ====================

const listProperties = define(
  "list_properties",
  "Liệt kê các nhà cho thuê đang hoạt động, kèm số phòng.",
  z.object({}),
  async () => {
    const props = await prisma.property.findMany({
      where: { userId: getUserId(), isActive: true },
      include: { _count: { select: { rooms: { where: { isActive: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    const data = props.map((p) => ({ id: p.id, name: p.name, address: p.address, monthlyRent: p.monthlyRent, rooms: p._count.rooms }));
    return { summary: `${data.length} nhà`, data };
  }
);

const createProperty = define(
  "create_property",
  "Tạo nhà cho thuê mới (tự thêm 3 loại phí mặc định: điện, nước, mạng).",
  z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    numFloors: z.number().int().min(1).optional(),
    monthlyRent: z.number().min(0).optional().describe("Tiền thuê trả chủ nhà mỗi tháng"),
    landlordName: z.string().optional(),
    landlordPhone: z.string().optional(),
  }),
  async (args) => {
    const p = await propertyService.create(args);
    return { summary: `Đã tạo nhà "${p.name}"`, data: { id: p.id } };
  },
  { write: true }
);

const updateProperty = define(
  "update_property",
  "Sửa thông tin nhà. Chỉ truyền các trường cần đổi.",
  z.object({
    id: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
    numFloors: z.number().int().min(1).optional(),
    monthlyRent: z.number().min(0).optional(),
    landlordName: z.string().optional(),
    landlordPhone: z.string().optional(),
    notes: z.string().optional(),
  }),
  async ({ id, ...data }) => {
    await assertOwnsProperty(id);
    const p = await prisma.property.update({ where: { id }, data });
    return { summary: `Đã cập nhật nhà "${p.name}"`, data: { id } };
  },
  { write: true }
);

// ==================== ROOMS ====================

const listRooms = define(
  "list_rooms",
  "Liệt kê phòng của một nhà, kèm người đang ở.",
  z.object({ propertyId: z.string() }),
  async ({ propertyId }) => {
    await assertOwnsProperty(propertyId);
    const rooms = await prisma.room.findMany({
      where: { propertyId, userId: getUserId() },
      include: { assignments: { where: { moveOutDate: null }, include: { tenant: { select: { id: true, name: true } } } } },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
    const data = rooms.map((r) => ({
      id: r.id, name: r.name, floor: r.floor, price: r.price, isActive: r.isActive,
      tenants: r.assignments.map((a) => a.tenant),
    }));
    return { summary: `${data.length} phòng`, data };
  }
);

const createRoom = define(
  "create_room",
  "Thêm phòng mới vào một nhà.",
  z.object({ propertyId: z.string(), name: z.string().min(1), floor: z.number().int(), price: z.number().min(0).describe("Giá thuê/tháng") }),
  async (args) => {
    const r = await roomRepo.create(args);
    return { summary: `Đã thêm phòng ${r.name} (${formatCurrency(r.price)}/tháng)`, data: { id: r.id } };
  },
  { write: true }
);

const updateRoom = define(
  "update_room",
  "Sửa phòng (tên, tầng, giá, ngừng hoạt động). Chỉ truyền các trường cần đổi.",
  z.object({ id: z.string(), name: z.string().optional(), floor: z.number().int().optional(), price: z.number().min(0).optional(), isActive: z.boolean().optional() }),
  async ({ id, ...data }) => {
    const r = await roomRepo.update(id, data);
    return { summary: `Đã cập nhật phòng ${r.name}`, data: { id } };
  },
  { write: true }
);

// ==================== TENANTS ====================

const listTenants = define(
  "list_tenants",
  "Liệt kê người thuê (có thể lọc theo nhà), kèm phòng đang ở.",
  z.object({ propertyId: z.string().optional() }),
  async ({ propertyId }) => {
    const tenants = await tenantRepo.findMany(propertyId);
    const data = tenants.map((t) => ({
      id: t.id, name: t.name, phone: t.phone, isFamily: t.isFamily, propertyId: t.propertyId,
      room: t.assignments[0] ? { id: t.assignments[0].room.id, name: t.assignments[0].room.name } : null,
    }));
    return { summary: `${data.length} người thuê`, data };
  }
);

async function addTenantsToRoom(roomId: string, tenantIds: string[]) {
  const active = await prisma.roomAssignment.findMany({ where: { roomId, userId: getUserId(), moveOutDate: null } });
  const all = [...new Set([...active.map((a) => a.tenantId), ...tenantIds])];
  return roomAssignmentRepo.setRoomTenants(roomId, all, new Date());
}

const createTenant = define(
  "create_tenant",
  "Thêm người thuê mới vào một nhà; nếu có roomId thì xếp luôn vào phòng đó.",
  z.object({
    propertyId: z.string(),
    name: z.string().min(1),
    phone: z.string().optional(),
    idNumber: z.string().optional().describe("Số CCCD"),
    isFamily: z.boolean().optional(),
    roomId: z.string().optional(),
  }),
  async ({ roomId, ...data }) => {
    const t = await tenantRepo.create({ ...data, isFamily: data.isFamily ?? false });
    let summary = `Đã thêm người thuê ${t.name}`;
    if (roomId) {
      const assignments = await addTenantsToRoom(roomId, [t.id]);
      const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
      summary += ` vào phòng ${room?.name} (${assignments.length} người)`;
    }
    return { summary, data: { id: t.id } };
  },
  { write: true }
);

const addTenantsToRoomTool = define(
  "add_tenants_to_room",
  "Xếp người thuê (đã có) vào phòng. Người đang ở phòng khác sẽ được chuyển sang; người đang ở phòng này được giữ nguyên.",
  z.object({ roomId: z.string(), tenantIds: z.array(z.string()).min(1) }),
  async ({ roomId, tenantIds }) => {
    const assignments = await addTenantsToRoom(roomId, tenantIds);
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    return { summary: `Phòng ${room?.name}: ${assignments.map((a) => a.tenant.name).join(", ")}` };
  },
  { write: true }
);

const moveOutTenant = define(
  "move_out_tenant",
  "Cho người thuê trả phòng (kết thúc lượt ở hiện tại).",
  z.object({ tenantId: z.string() }),
  async ({ tenantId }) => {
    const active = await prisma.roomAssignment.findFirst({
      where: { tenantId, userId: getUserId(), moveOutDate: null },
      include: { tenant: true, room: true },
    });
    if (!active) throw new NotFoundError("Người này hiện không ở phòng nào");
    await roomAssignmentRepo.moveOut(active.id);
    return { summary: `${active.tenant.name} đã trả phòng ${active.room.name}` };
  },
  { write: true }
);

// ==================== FEE TYPES ====================

const listFeeTypes = define(
  "list_fee_types",
  "Liệt kê loại phí của một nhà. rooms rỗng = áp dụng cho tất cả phòng.",
  z.object({ propertyId: z.string() }),
  async ({ propertyId }) => {
    const fees = await feeTypeRepo.findMany(propertyId);
    const data = fees.map((f) => ({
      id: f.id, name: f.name, calcMode: f.calcMode, defaultPrice: f.defaultPrice, unit: f.unit, roomIds: f.rooms.map((r) => r.roomId),
    }));
    return { summary: `${data.length} loại phí`, data };
  }
);

const createFeeType = define(
  "create_fee_type",
  "Thêm loại phí cho một nhà. calcMode: PER_UNIT (theo số lượng, VD điện kWh), PER_PERSON (theo số người), FIXED (cố định/phòng). roomIds để trống = áp dụng mọi phòng. Chỉ có hiệu lực cho hóa đơn tạo sau này.",
  z.object({
    propertyId: z.string(),
    name: z.string().min(1),
    calcMode: calcModeSchema,
    defaultPrice: z.number().describe("Số âm = giảm trừ hằng tháng"),
    unit: z.string().optional(),
    roomIds: z.array(z.string()).optional(),
  }),
  async ({ roomIds, ...data }) => {
    const f = await feeTypeRepo.create(data, roomIds ?? []);
    const scope = f.rooms.length ? `${f.rooms.length} phòng` : "tất cả phòng";
    return { summary: `Đã thêm loại phí "${f.name}" ${formatCurrency(f.defaultPrice)} (${scope})`, data: { id: f.id } };
  },
  { write: true }
);

// ==================== BILLING ====================

const getBillingPeriod = define(
  "get_billing_period",
  "Xem hóa đơn tháng của một nhà: từng phòng, các khoản phí, tổng tiền, đã thu chưa. Trả null nếu chưa tạo.",
  z.object({ propertyId: z.string(), month: z.number().int().min(1).max(12), year: z.number().int() }),
  async ({ propertyId, month, year }) => {
    const p = await billingService.getPeriod(propertyId, month, year);
    if (!p) return { summary: `Chưa có hóa đơn tháng ${month}/${year}`, data: null };
    const data = {
      id: p.id, isLocked: p.isLocked,
      items: p.items.map((i) => ({
        billingItemId: i.id, room: i.snapshotRoomName, numPeople: i.snapshotNumPeople, roomPrice: i.snapshotPrice,
        total: i.totalAmount, isPaid: i.isPaid,
        fees: i.fees.map((f) => ({ name: f.feeName, calcMode: f.calcMode, unitPrice: f.unitPrice, quantity: f.quantity, amount: f.amount, isExtra: f.isExtra })),
      })),
    };
    return { summary: `Hóa đơn tháng ${month}/${year}: ${data.items.length} phòng`, data };
  }
);

const createBillingPeriod = define(
  "create_billing_period",
  "Tạo hóa đơn tháng cho một nhà: sinh hóa đơn cho mọi phòng đang có người ở (không ghi đè phòng đã có hóa đơn).",
  z.object({ propertyId: z.string(), month: z.number().int().min(1).max(12), year: z.number().int() }),
  async ({ propertyId, month, year }) => {
    const p = await billingService.generatePeriod(propertyId, month, year);
    return { summary: `Đã tạo hóa đơn tháng ${month}/${year}: ${p?.items.length ?? 0} phòng`, data: { id: p?.id } };
  },
  { write: true }
);

const setBillingFee = define(
  "set_billing_fee",
  "Đặt số lượng và/hoặc đơn giá cho một khoản phí trong hóa đơn của một phòng (VD: số kWh điện tháng này). Lấy billingItemId từ get_billing_period.",
  z.object({
    billingItemId: z.string(),
    feeName: z.string().describe("Tên khoản phí, VD: Tiền điện"),
    quantity: z.number().min(0).optional(),
    unitPrice: z.number().optional(),
  }),
  async ({ billingItemId, feeName, quantity, unitPrice }) => {
    const item = await billingService.getEditableItem(billingItemId);
    const q = feeName.toLowerCase();
    const exact = item.fees.findIndex((f) => f.feeName.toLowerCase() === q);
    const idx = exact >= 0
      ? exact
      : item.fees.findIndex((f) => f.feeName.toLowerCase().includes(q) || q.includes(f.feeName.toLowerCase()));
    if (idx < 0) throw new NotFoundError(`Phòng ${item.snapshotRoomName} không có khoản "${feeName}". Các khoản: ${item.fees.map((f) => f.feeName).join(", ")}`);
    const fees = item.fees.map((f, i) => ({
      ...f,
      quantity: i === idx && quantity !== undefined ? quantity : f.quantity,
      unitPrice: i === idx && unitPrice !== undefined ? unitPrice : f.unitPrice,
    }));
    const updated = await billingService.updateItemFees(billingItemId, fees);
    const f = fees[idx];
    return {
      summary: `Phòng ${item.snapshotRoomName}: ${f.feeName} ${f.quantity} × ${formatCurrency(f.unitPrice)} → tổng ${formatCurrency(updated.totalAmount)}`,
    };
  },
  { write: true }
);

const addExtraFee = define(
  "add_extra_fee",
  "Thêm khoản phát sinh (chỉ tháng này) vào hóa đơn của một phòng, VD: sửa vòi nước 150000. Số âm = giảm trừ, VD: giảm 100000 vì mất nước.",
  z.object({ billingItemId: z.string(), name: z.string().min(1), amount: z.number() }),
  async ({ billingItemId, name, amount }) => {
    const item = await billingService.getEditableItem(billingItemId);
    const updated = await billingService.updateItemFees(billingItemId, [
      ...item.fees,
      { feeName: name, calcMode: "FIXED", unitPrice: amount, quantity: 1, isExtra: true },
    ]);
    return { summary: `Phòng ${item.snapshotRoomName}: thêm "${name}" ${formatCurrency(amount)} → tổng ${formatCurrency(updated.totalAmount)}` };
  },
  { write: true }
);

const setBillingItemPaid = define(
  "set_billing_item_paid",
  "Đánh dấu hóa đơn của một phòng đã thu tiền hoặc chưa thu.",
  z.object({ billingItemId: z.string(), isPaid: z.boolean() }),
  async ({ billingItemId, isPaid }) => {
    const item = await billingService.setItemPaid(billingItemId, isPaid);
    const room = await prisma.billingItem.findUnique({ where: { id: item.id }, select: { snapshotRoomName: true } });
    return { summary: `Phòng ${room?.snapshotRoomName}: ${isPaid ? "đã thu" : "chưa thu"} ${formatCurrency(item.totalAmount)}` };
  },
  { write: true }
);

// ==================== DASHBOARD ====================

const getDashboardStats = define(
  "get_dashboard_stats",
  "Tổng quan thu, chi, lợi nhuận cho thuê theo tuần/tháng/quý/năm hiện tại.",
  z.object({ period: z.enum(["week", "month", "quarter", "year"]).optional() }),
  async ({ period }) => {
    const s = await dashboardService.getStats(period ?? "month");
    return {
      summary: "Đã xem tổng quan",
      data: {
        period: { type: s.period.type, start: ymd(s.period.start), end: ymd(s.period.end) },
        totalIncome: s.totalIncome, totalExpense: s.totalExpense, netAmount: s.netAmount,
        rentalIncome: s.rentalIncome, rentalCost: s.rentalCost, rentalProfit: s.rentalProfit,
        byCategory: s.categoryBreakdown.map((c) => ({ category: c.category?.name, type: c.type, total: c.total })),
      },
    };
  }
);

export const tools = [
  listCategories, createCategory,
  listTransactions, createTransaction, updateTransaction,
  listProperties, createProperty, updateProperty,
  listRooms, createRoom, updateRoom,
  listTenants, createTenant, addTenantsToRoomTool, moveOutTenant,
  listFeeTypes, createFeeType,
  getBillingPeriod, createBillingPeriod, setBillingFee, addExtraFee, setBillingItemPaid,
  getDashboardStats,
];
