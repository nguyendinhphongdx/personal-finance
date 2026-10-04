export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export class NotFoundError extends Error {
  constructor(message = "Không tìm thấy") {
    super(message);
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}
