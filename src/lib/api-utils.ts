import { NextResponse } from "next/server";
import { auth } from "./auth";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireAuth() {
  const userId = await getAuthUserId();
  if (!userId) {
    throw new AuthError();
  }
  return userId;
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return error("Vui lòng đăng nhập", 401);
  }
  console.error(err);
  return error("Lỗi hệ thống", 500);
}
