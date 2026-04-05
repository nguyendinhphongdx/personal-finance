import { prisma } from "@/lib/prisma";
import { success, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireAuth();

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Fetch properties with rooms + tenants
    const properties = await prisma.property.findMany({
      where: { userId, isActive: true },
      include: {
        rooms: {
          where: { isActive: true },
          include: { tenants: { where: { moveOutDate: null } } },
        },
      },
    });

    // Fetch current month billing for all properties
    const currentBillings = await prisma.billingPeriod.findMany({
      where: { userId, month: currentMonth, year: currentYear },
      include: {
        items: { include: { fees: true } },
      },
    });

    // Fetch previous month billing
    const prevBillings = await prisma.billingPeriod.findMany({
      where: { userId, month: prevMonth, year: prevYear },
      include: {
        items: { include: { fees: true } },
      },
    });

    // Fetch last 6 months billing for trend
    const sixMonthsAgo = new Date(currentYear, currentMonth - 7, 1);
    const allBillings = await prisma.billingPeriod.findMany({
      where: {
        userId,
        createdAt: { gte: sixMonthsAgo },
      },
      include: {
        items: { include: { fees: true } },
        property: { select: { name: true, monthlyRent: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    // Aggregate stats
    const totalRooms = properties.reduce((s, p) => s + p.rooms.length, 0);
    const occupiedRooms = properties.reduce((s, p) => s + p.rooms.filter((r) => r.tenants.length > 0).length, 0);
    const totalTenants = properties.reduce((s, p) => s + p.rooms.reduce((rs, r) => rs + r.tenants.length, 0), 0);
    const totalMonthlyRent = properties.reduce((s, p) => s + (p.monthlyRent || 0), 0);

    // Current month stats
    const currentRevenue = currentBillings.reduce((s, b) => s + b.items.reduce((is, i) => is + i.totalAmount, 0), 0);
    const currentPaid = currentBillings.reduce((s, b) => s + b.items.filter((i) => i.isPaid).reduce((is, i) => is + i.totalAmount, 0), 0);
    const currentUnpaid = currentRevenue - currentPaid;
    const currentLandlord = currentBillings.reduce((s, b) => s + (b.landlordPayment ?? 0), 0);
    const currentElectric = currentBillings.reduce((s, b) => s + (b.actualElectricBill ?? 0), 0);
    const currentProfit = currentPaid - currentLandlord - currentElectric;

    // Previous month stats for comparison
    const prevRevenue = prevBillings.reduce((s, b) => s + b.items.reduce((is, i) => is + i.totalAmount, 0), 0);
    const prevPaid = prevBillings.reduce((s, b) => s + b.items.filter((i) => i.isPaid).reduce((is, i) => is + i.totalAmount, 0), 0);
    const prevLandlord = prevBillings.reduce((s, b) => s + (b.landlordPayment ?? 0), 0);
    const prevElectric = prevBillings.reduce((s, b) => s + (b.actualElectricBill ?? 0), 0);
    const prevProfit = prevPaid - prevLandlord - prevElectric;

    // Monthly trend
    const trend = allBillings.reduce((acc, b) => {
      const key = `${b.year}-${String(b.month).padStart(2, "0")}`;
      const existing = acc.find((t) => t.month === key);
      const revenue = b.items.reduce((s, i) => s + i.totalAmount, 0);
      const paid = b.items.filter((i) => i.isPaid).reduce((s, i) => s + i.totalAmount, 0);
      const landlord = b.landlordPayment ?? b.property?.monthlyRent ?? 0;
      const electric = b.actualElectricBill ?? 0;
      const profit = paid - landlord - electric;

      if (existing) {
        existing.revenue += revenue;
        existing.paid += paid;
        existing.cost += landlord + electric;
        existing.profit += profit;
      } else {
        acc.push({ month: key, revenue, paid, cost: landlord + electric, profit });
      }
      return acc;
    }, [] as { month: string; revenue: number; paid: number; cost: number; profit: number }[]);

    // Per-property summary for current month
    const propertyStats = properties.map((p) => {
      const billing = currentBillings.find((b) => b.propertyId === p.id);
      const rooms = p.rooms.length;
      const occupied = p.rooms.filter((r) => r.tenants.length > 0).length;
      const revenue = billing?.items.reduce((s, i) => s + i.totalAmount, 0) ?? 0;
      const paid = billing?.items.filter((i) => i.isPaid).reduce((s, i) => s + i.totalAmount, 0) ?? 0;
      const unpaidCount = billing?.items.filter((i) => !i.isPaid).length ?? 0;
      const landlord = billing?.landlordPayment ?? p.monthlyRent ?? 0;
      const electric = billing?.actualElectricBill ?? 0;
      const profit = paid - landlord - electric;

      return {
        id: p.id,
        name: p.name,
        address: p.address,
        rooms,
        occupied,
        occupancyRate: rooms > 0 ? Math.round((occupied / rooms) * 100) : 0,
        tenants: p.rooms.reduce((s, r) => s + r.tenants.length, 0),
        revenue,
        paid,
        unpaidCount,
        landlord,
        profit,
        hasBilling: !!billing,
        isLocked: billing?.isLocked ?? false,
      };
    });

    return success({
      overview: {
        totalProperties: properties.length,
        totalRooms,
        occupiedRooms,
        emptyRooms: totalRooms - occupiedRooms,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        totalTenants,
        totalMonthlyRent,
      },
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        revenue: currentRevenue,
        paid: currentPaid,
        unpaid: currentUnpaid,
        landlord: currentLandlord,
        electric: currentElectric,
        profit: currentProfit,
      },
      comparison: {
        revenueDiff: currentRevenue - prevRevenue,
        profitDiff: currentProfit - prevProfit,
        prevRevenue,
        prevProfit,
      },
      trend,
      propertyStats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
