// v1.0
export class SearchClientError extends Error {
  constructor(message: string) { super(message); this.name = "SearchClientError"; }
}
export class SearchTimeoutError extends SearchClientError {
  constructor(message: string) { super(message); this.name = "SearchTimeoutError"; }
}
export class SearchConnectionError extends SearchClientError {
  constructor(message: string) { super(message); this.name = "SearchConnectionError"; }
}
export class SearchHTTPError extends SearchClientError {
  status_code: number | null;
  constructor(message: string, statusCode: number | null = null) {
    super(message); this.name = "SearchHTTPError"; this.status_code = statusCode;
  }
}
export class SearchParseError extends Error {
  constructor(message: string) { super(message); this.name = "SearchParseError"; }
}
