import "jest";
import { FilterManager, INotification } from "../src/FilterManager";

describe("FilterManager", () => {
  let fm: FilterManager;
  const socketId: string = "testSocketId";
  const filter: any = {
    fields: {
      subject: {
        operation: ">",
        value: 1,
      },
    },
  };

  beforeEach(() => {
    fm = new FilterManager();
  });

  describe("constructor", () => {
    it("should build an empty filter manager", () => {
      expect(fm).toBeDefined();
    });
  });

  describe("applyOperation", () => {
    it("should process logical operations", () => {
      expect(fm.applyOperation("!=", 1, 2)).toBeTruthy();
      expect(fm.applyOperation("!=", 1, 1)).toBeFalsy();

      expect(fm.applyOperation("=", 1, 1)).toBeTruthy();
      expect(fm.applyOperation("=", 1, 2)).toBeFalsy();

      expect(fm.applyOperation(">", 1, 0)).toBeTruthy();
      expect(fm.applyOperation(">", 1, 1)).toBeFalsy();
      expect(fm.applyOperation(">", 1, 2)).toBeFalsy();

      expect(fm.applyOperation("<", 1, 2)).toBeTruthy();
      expect(fm.applyOperation("<", 1, 1)).toBeFalsy();
      expect(fm.applyOperation("<", 1, 0)).toBeFalsy();
    });
  });

  describe("update", () => {
    it("should update filters", () => {
      fm.update(filter, socketId);
    });
  });

  describe("removeFilter", () => {
    it("should remove filters", () => {
      fm.removeFilter(socketId);
    });
  });

  describe("checkFilter", () => {
    let msg: INotification;

    beforeEach(() => {
      fm.update(filter, socketId);
      msg = {
        message: "testMessage",
        metaAttrsFilter: {},
        msgId: "testMsgId",
        subject: "2",
        timestamp: 1,
      };
    });

    it("should check the filter - check returns true with msg subject === 2", () => {
      // 2 > 1 should be true
      msg.subject = "2";
      msg.metaAttrsFilter = {
        priority: "testPriority",
        shouldPersist: true,
      };

      expect(fm.checkFilter(JSON.stringify(msg), socketId)).toBeTruthy();
    });

    it("should check the filter - check returns false with msg subject === 0", () => {
      // 0 > 1 should be false
      msg.subject = "0";
      msg.metaAttrsFilter = {
        priority: "testPriority",
        shouldPersist: true,
      };

      expect(fm.checkFilter(JSON.stringify(msg), socketId)).toBeFalsy();
    });

    it("should check the filter - check returns false with metaAttrsFilter being used", () => {
      msg.subject = "2";
      msg.metaAttrsFilter = {
        shouldPersist: true,
        testValue: "1",
      };

      // Adding testValue to the filter fields
      filter.fields.testValue = { operation: "=", value: "2" };

      expect(fm.checkFilter(JSON.stringify(msg), socketId)).toBeFalsy();
    });

    it("should check the filter - check returns true with metaAttrsFilter being used", () => {
      msg.subject = "2";
      msg.metaAttrsFilter = {
        shouldPersist: true,
        testValue: "2",
      };

      // Adding testValue to the filter fields
      filter.fields.testValue = { operation: "=", value: "2" };

      expect(fm.checkFilter(JSON.stringify(msg), socketId)).toBeTruthy();
    });

    it("should check the filter - check returns true with metaAttrsFilter without testValue", () => {
      msg.subject = "2";
      msg.metaAttrsFilter = {
        shouldPersist: true,
        sub: "2",
      };

      // Adding testValue to the filter fields
      filter.fields.testValue = { operation: "=", value: "2" };

      expect(fm.checkFilter(JSON.stringify(msg), socketId)).toBeTruthy();
    });

    it("should check the filter - check returns true with metaAttrsFilter being used", () => {
      expect(fm.checkFilter(JSON.stringify(msg), "otherSocketId")).toBeTruthy();
    });
  });
});
