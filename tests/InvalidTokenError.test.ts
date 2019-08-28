import { InvalidTokenError } from "../src/api/InvalidTokenError";

describe("InvalidTokenError", () => {
  it("should build a valid instance", () => {
    const obj = new InvalidTokenError();
    expect(obj).toBeDefined();

    const stripped = obj as any;
    expect(stripped.message).toEqual("Invalid authentication token given");
  });
});
