import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  userId: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ userId }, fn);
}

export function getUserId(): string {
  const ctx = als.getStore();
  if (!ctx) {
    throw new Error("getUserId() called outside request context — wrap the route handler with withUserContext()");
  }
  return ctx.userId;
}
