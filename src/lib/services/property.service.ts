import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/request-context";

export const propertyService = {
  /** Create a property and seed its default fee types (điện, nước, mạng). */
  create: async (data: {
    name: string;
    address?: string | null;
    numFloors?: number;
    monthlyRent?: number | null;
    landlordName?: string | null;
    landlordPhone?: string | null;
    notes?: string | null;
  }) => {
    const userId = getUserId();
    const property = await prisma.property.create({
      data: { ...data, numFloors: data.numFloors || 1, userId },
    });

    await prisma.feeType.createMany({
      data: [
        { name: "Tiền điện", unit: "kWh", calcMode: "PER_UNIT", defaultPrice: 4000, sortOrder: 1, isDefault: true, propertyId: property.id, userId },
        { name: "Tiền nước", unit: "người", calcMode: "PER_PERSON", defaultPrice: 50000, sortOrder: 2, isDefault: true, propertyId: property.id, userId },
        { name: "Tiền mạng", calcMode: "FIXED", defaultPrice: 50000, sortOrder: 3, isDefault: true, propertyId: property.id, userId },
      ],
    });

    return property;
  },
};
