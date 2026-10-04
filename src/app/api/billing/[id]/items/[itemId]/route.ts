import { NextRequest } from "next/server";
import { success, error, withUserContext, handleApiError } from "@/lib/api-utils";
import { billingService } from "@/lib/services/billing.service";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    return await withUserContext(async () => {
      const { itemId } = await params;
      const body = await req.json();

      // Replace the whole fee list (fees from FeeTypes + ad-hoc extras added for this month)
      if (body.fees) {
        if (!Array.isArray(body.fees)) return error("Danh sách phí không hợp lệ");
        const updated = await billingService.updateItemFees(itemId, body.fees);
        return success(updated);
      }

      if (body.isPaid !== undefined) {
        const updated = await billingService.setItemPaid(itemId, body.isPaid === true);
        return success(updated);
      }

      return error("Không có dữ liệu cập nhật");
    });
  } catch (err) {
    return handleApiError(err);
  }
}
