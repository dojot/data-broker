/* jshint node: true */
"use strict";

import "jest";
import { tokenize } from "../src/simple-tools";

describe("simpleTools", () => {
  describe("tokenize", () => {
    let text: string;

    beforeAll(() => {
      text = "test1:test2";
    });

    it("should return two tokens - text with matching token", () => {
      const tokens = tokenize(text, ":");

      expect(tokens).toEqual(["test1", "test2"]);
    });

    it("should return one token - text without matching token", () => {
      const tokens = tokenize(text, ".");

      expect(tokens).toEqual(["test1:test2"]);
    });

    it("should return one token - empty token", () => {
      const tokens = tokenize(text, "");

      expect(tokens).toEqual(["test1:test2"]);
    });

    it("should not return tokens - empty text", () => {
      const tokens = tokenize("", ":");

      expect(tokens).toEqual([""]);
    });
  });
});
