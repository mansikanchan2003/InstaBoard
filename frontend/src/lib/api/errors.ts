/** Thrown when a record does not exist (demo store lookup, or a 404 from the API). Screens render a "not found" state for it. */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
    this.name = 'NotFoundError';
  }
}

/** A 404 returned by the FastAPI backend; keeps the server's message. */
export class ApiNotFoundError extends NotFoundError {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super('Record', '');
    this.message = message;
    this.name = 'ApiNotFoundError';
  }
}
