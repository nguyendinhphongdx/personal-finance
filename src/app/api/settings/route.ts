import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error, requireAuth, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireAuth();
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    // Mask API key for security
    if (settings?.aiApiKey) {
      const key = settings.aiApiKey;
      settings.aiApiKey = key.slice(0, 8) + "..." + key.slice(-4);
    }
    return success(settings);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { aiProvider, aiModel, aiApiKey } = await req.json();

    const data: Record<string, string | null> = {};
    if (aiProvider !== undefined) data.aiProvider = aiProvider || null;
    if (aiModel !== undefined) data.aiModel = aiModel || null;
    // Only update API key if a real new value is provided (not masked)
    if (aiApiKey !== undefined && !aiApiKey.includes("...")) {
      data.aiApiKey = aiApiKey || null;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    // Mask key in response
    if (settings.aiApiKey) {
      const key = settings.aiApiKey;
      settings.aiApiKey = key.slice(0, 8) + "..." + key.slice(-4);
    }

    return success(settings);
  } catch (err) {
    return handleApiError(err);
  }
}
