import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return error("Vui lòng điền đầy đủ thông tin", 400);
    }

    if (password.length < 6) {
      return error("Mật khẩu phải có ít nhất 6 ký tự", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return error("Email đã được sử dụng", 409);
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true },
    });

    // Seed default categories for new user
    await seedDefaultCategories(user.id);

    return success(user, 201);
  } catch (err) {
    console.error(err);
    return error("Lỗi hệ thống", 500);
  }
}

async function seedDefaultCategories(userId: string) {
  const defaults = [
    { name: "Lương", type: "INCOME" as const, icon: "Wallet", color: "#22c55e" },
    { name: "Thu nhập khác", type: "INCOME" as const, icon: "TrendingUp", color: "#06b6d4" },
    { name: "Tiền nhà", type: "INCOME" as const, icon: "Home", color: "#f59e0b" },
    { name: "Ăn uống", type: "EXPENSE" as const, icon: "UtensilsCrossed", color: "#ef4444" },
    { name: "Di chuyển", type: "EXPENSE" as const, icon: "Car", color: "#8b5cf6" },
    { name: "Mua sắm", type: "EXPENSE" as const, icon: "ShoppingBag", color: "#ec4899" },
    { name: "Hóa đơn", type: "EXPENSE" as const, icon: "Receipt", color: "#f97316" },
    { name: "Giải trí", type: "EXPENSE" as const, icon: "Gamepad2", color: "#06b6d4" },
    { name: "Sức khỏe", type: "EXPENSE" as const, icon: "Heart", color: "#14b8a6" },
    { name: "Khác", type: "EXPENSE" as const, icon: "MoreHorizontal", color: "#6b7280" },
  ];

  await prisma.category.createMany({
    data: defaults.map((c) => ({ ...c, isDefault: true, userId })),
  });
}

// Fee types are now seeded per property when creating a new property
