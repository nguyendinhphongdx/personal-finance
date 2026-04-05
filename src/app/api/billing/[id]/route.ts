import { NextRequest } from "next/server";
import { billingService } from "@/lib/services/billing.service";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    if (body.action === "lock") {
      const data = await billingService.lockPeriod(id);
      return success(data);
    }

    if (body.action === "unlock") {
      const data = await billingService.unlockPeriod(id);
      return success(data);
    }

    if (body.action === "togglePaid" && body.itemId) {
      const data = await billingService.togglePaid(body.itemId, body.isPaid);
      return success(data);
    }

    // Update summary
    const { actualElectricBill, landlordPayment, totalCollected, notes } = body;
    const data = await billingService.updatePeriodSummary(id, {
      actualElectricBill, landlordPayment, totalCollected, notes,
    });
    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await billingService.deletePeriod(id);
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
