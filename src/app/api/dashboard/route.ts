import { NextRequest } from "next/server";
import { dashboardService } from "@/lib/services/dashboard.service";
import { success, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = req.nextUrl;
    const period = (searchParams.get("period") as "week" | "month" | "quarter" | "year") ?? "month";
    const dateStr = searchParams.get("date");
    const date = dateStr ? new Date(dateStr) : new Date();

    const [stats, trend] = await Promise.all([
      dashboardService.getStats(userId, period, date),
      dashboardService.getMonthlyTrend(userId, 6),
    ]);

    return success({ ...stats, trend });
  } catch (err) {
    return handleApiError(err);
  }
}
