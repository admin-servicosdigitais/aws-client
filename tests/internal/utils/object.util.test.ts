import { describe, expect, it } from "vitest";
import { removeUndefinedFields } from "../../../src/internal/utils/object.util.js";

describe("removeUndefinedFields", () => {
  it("removes only undefined fields", () => {
    const input = {
      a: 1,
      b: undefined,
      c: null,
      d: "",
      e: false,
    };

    const output = removeUndefinedFields(input);

    expect(output).toEqual({
      a: 1,
      c: null,
      d: "",
      e: false,
    });
  });
});
