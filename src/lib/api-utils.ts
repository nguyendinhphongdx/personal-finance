import { NextResponse } from "next/server";
import { auth } from "./auth";
import { runWithUser } from "./request-context";
import { AuthError, NotFoundError, BadRequestError } from "./errors";

export { AuthError, NotFoundError, BadRequestError };

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

/**
 * Wrap a route handler body: resolves the current user once, then runs `fn`
 * inside an AsyncLocalStorage scope so any repo/service call underneath can
 * read it via `getUserId()` without threading `userId` through every layer.
 */
export async function withUserContext<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  const userId = await requireAuth();
  return runWithUser(userId, () => fn(userId));
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return error("Vui lòng đăng nhập", 401);
  }
  if (err instanceof NotFoundError) {
    return error(err.message, 404);
  }
  if (err instanceof BadRequestError) {
    return error(err.message, 400);
  }
  console.error(err);
  return error("Lỗi hệ thống", 500);
}
