import "jest";
import { ClientWrapper, IAutoScheme, ITopicProfile } from "../src/RedisClientWrapper";

class RedisClientStub {
  public evalsha: jest.Mock;
  public get: jest.Mock;
  public scan: jest.Mock;
  public script: jest.Mock;
  public select: jest.Mock;
  public set: jest.Mock;

  constructor() {
    this.evalsha = jest.fn();
    this.get = jest.fn();
    this.scan = jest.fn();
    this.script = jest.fn((arg1: any, arg2: any, cb?: any) => {
      if (cb) {
        // to test the callback code
        cb();
      }
    });
    this.select = jest.fn();
    this.set = jest.fn();
  }
}

jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "testData"),
}));

describe("RedisClientWrapper", () => {
  const redisStub = new RedisClientStub();

  let clientWrapper: ClientWrapper;

  beforeEach(() => {
    redisStub.get.mockClear();
    redisStub.scan.mockClear();
    redisStub.select.mockClear();
    redisStub.set.mockClear();
    redisStub.evalsha.mockClear();
    clientWrapper = new ClientWrapper(redisStub as any);
  });

  it("should build an empty Wrapper", (done) => {
    expect(clientWrapper.client).toBe(redisStub);
    done();
  });

  it("should not crash when there's no profile", (done) => {
    // Main test
    const promise = clientWrapper.getConfig("empty-redis-profile");
    expect(redisStub.select).toBeCalledWith(1);
    expect(promise).toBeInstanceOf(Promise);
    promise.then((data: ITopicProfile | undefined) => {
      expect(data).toEqual({});
      done();
    }).catch((error: any) => {
      done(error);
    });

    let expected = [];
    // Mocking listing keys
    expected = ["0", "MATCH", "*:empty-redis-profile"];
    expect(redisStub.scan.mock.calls[0].slice(0, -1)).toEqual(expected);
    redisStub.scan.mock.calls[0][expected.length](undefined, [
      "0",
      [],
    ]);
    done();
  });

  describe("get topic variations", () => {
    // All test cases are valid with this output.
    // This function checks the final results.
    function start(done: jest.DoneCallback) {
      const promise = clientWrapper.getConfig("sample-subject");
      expect(redisStub.select).toBeCalledWith(1);
      expect(promise).toBeInstanceOf(Promise);
      promise.then((data: ITopicProfile | undefined) => {
        expect(data).not.toEqual({});
        expect(data).toHaveProperty("*");
        const topicScheme = data!["*"] as IAutoScheme;
        expect(topicScheme.num_partitions).toBe(10);
        expect(topicScheme.replication_factor).toBe(1);
        done();
      }).catch((error: any) => {
        done(error);
      });
    }

    it("should return a valid topic profile with only one key", (done) => {
      start(done);

      let expected = [];
      // Mocking listing keys
      expected = ["0", "MATCH", "*:sample-subject"];
      expect(redisStub.scan.mock.calls[0].slice(0, -1)).toEqual(expected);
      redisStub.scan.mock.calls[0][expected.length](undefined, [
        "0",
        ["*:sample-subject"],
      ]);

      // Mocking the returned results for that key
      const [, callback] = redisStub.get.mock.calls[0];
      const sampleResult: IAutoScheme = {
        num_partitions: 10,
        replication_factor: 1,
      };
      callback(undefined, JSON.stringify(sampleResult));

      done();
    });

    it("should return a valid topic profile with more than one key", (done) => {
      start(done);

      let expected = [];
      // Mocking listing keys
      expected = ["0", "MATCH", "*:sample-subject"];
      expect(redisStub.scan.mock.calls[0].slice(0, -1)).toEqual(expected);
      redisStub.scan.mock.calls[0][expected.length](undefined, [
        "1",
        ["*:sample-subject1"],
      ]);

      expected = ["1", "MATCH", "*:sample-subject"];
      expect(redisStub.scan.mock.calls[1].slice(0, -1)).toEqual(expected);
      redisStub.scan.mock.calls[0][expected.length](undefined, [
        "0",
        ["*:sample-subject"],
      ]);

      // Mocking the returned results for that key
      const [, callback] = redisStub.get.mock.calls[0];
      const sampleResult: IAutoScheme = {
        num_partitions: 10,
        replication_factor: 1,
      };
      callback(undefined, JSON.stringify(sampleResult));
      done();
    });
  });

  describe("get topic profile with a faulty Redis", () => {
    // All test cases are valid with this output.
    // This function checks the final results.
    function start(done: jest.DoneCallback) {
      const promise = clientWrapper.getConfig("faulty-redis");
      expect(redisStub.select).toBeCalledWith(1);
      expect(promise).toBeInstanceOf(Promise);
      promise.then((data: ITopicProfile | undefined) => {
        done("should not be ok");
      }).catch((error: any) => {
        expect(error).toBe("generic-error");
        done();
      });
    }

    it("should return an error when failing at scanning keys", (done) => {
      start(done);

      let expected = [];
      // Mocking listing keys
      expected = ["0", "MATCH", "*:faulty-redis"];
      expect(redisStub.scan.mock.calls[0].slice(0, -1)).toEqual(expected);
      redisStub.scan.mock.calls[0][expected.length]("generic-error", []);
    });

    it("should return an error when getting values", (done) => {
      start(done);

      // Mocking listing keys
      const length = redisStub.scan.mock.calls[0].length;
      redisStub.scan.mock.calls[0][length - 1](undefined, [
        "0",
        ["*:faulty-subject"],
      ]);

      // Mocking the returned results for that key
      const [, callback] = redisStub.get.mock.calls[0];
      callback("generic-error");

      done();
    });
  });

  describe("Redis write access", () => {
    it("should call Redis correctly", (done) => {
      clientWrapper.setConfig("test-key", "test-value");
      expect(redisStub.select).toBeCalledWith(1);
      expect(redisStub.set).toBeCalledWith("test-key", "test-value");
      done();
    });
  });

  describe("runScript", () => {
    const testPath: string = "testPath";
    const testKeys: string[] = ["testKey1", "testKey2"];
    const testVals: string[] = ["testVal1", "testVal2"];
    const testCallback = jest.fn((error: any, data: any) => {
      if (error) {
        throw new Error();
      }
    });
    const evalshaFn1WithoutError = jest.fn((arg1: any, arg2: any, arg3: any, arg4: any, cb?: any) => {
      if (cb) {
        cb(undefined, "testData");
      }
    });
    const evalshaFn1WithErrorNoScript = jest.fn((arg1: any, arg2: any, arg3: any, arg4: any, cb?: any) => {
      if (cb) {
        cb({code: "NOSCRIPT"}, "testData");
      }
    });
    const evalshaFn2WithoutError = jest.fn((arg1: any, arg2: any, arg3: any, cb?: any) => {
      if (cb) {
        cb(undefined, "testData");
      }
    });
    const evalshaFn2WithErrorNoScript = jest.fn((arg1: any, arg2: any, arg3: any, cb?: any) => {
      if (cb) {
        cb({code: "NOSCRIPT"}, "testData");
      }
    });

    beforeEach(() => {
      testCallback.mockClear();
    });

    it("should run the script - with vals", () => {
      redisStub.evalsha = evalshaFn1WithoutError;
      expect(() => clientWrapper.runScript(testPath, testKeys, testVals, testCallback)).not.toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should run the script - without vals", () => {
      redisStub.evalsha = evalshaFn2WithoutError;
      expect(() => clientWrapper.runScript(testPath, testKeys, [], testCallback)).not.toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should run the script - with error code NOSCRIPT", () => {
      redisStub.evalsha = evalshaFn1WithErrorNoScript;
      expect(() => clientWrapper.runScript(testPath, testKeys, testVals, testCallback)).toThrow();
      expect(testCallback).toHaveBeenCalled();
    });

    it("should not run the script - without vals and with code error NOSCRIPT", () => {
      redisStub.evalsha = evalshaFn2WithErrorNoScript;
      expect(() => clientWrapper.runScript(testPath, testKeys, [], testCallback)).toThrow();
      expect(testCallback).toHaveBeenCalled();
    });
  });
});
