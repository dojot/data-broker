import { UnauthorizedError } from "../src/api/UnauthorizedError"

describe("InvalidTokenError", () => {
  it("should build a valid instance", () => {
    const obj = new UnauthorizedError();
    expect(obj).toBeDefined();

    const stripped = obj as any;
    expect(stripped.message).toEqual("Authentication (JWT) required for API");
  });
});