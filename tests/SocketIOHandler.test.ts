/* jslint node: true */

import { Messenger } from "@dojot/dojot-module";
import "jest";
import { Callback } from "redis";
import { SocketIOHandler } from "../src/SocketIOHandler";

/**
 * Variables
 */
// Callback control
// For function redis.client.get()
let cbError: Error | null;
let cbReply: string;
// Mock functions
const mockConfig = {
  socketIO: {
    on: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    use: jest.fn(),
  },

  uuid: "sample-uuid",

  Messenger: {
    init: jest.fn(),
    on: jest.fn(),
    unregisterCallback: jest.fn(),
  },

  FilterManager: {
    checkFilter: jest.fn(),
    update: jest.fn(),
  },

  ClientWrapper: {
    client: {
      createClient: jest.fn(),
      get: jest.fn((key: string, cb?: Callback<string> | undefined) => {
        if (cb) {
          cb(cbError, cbReply);
        }
      }),
      select: jest.fn(),
      setex: jest.fn(),
    },
    getConfig: jest.fn(),
    runScript: jest.fn(),
  },

  TopicManager: {
    getCreateTopic: jest.fn(),
  },

  socketSample: {
    disconnect: jest.fn(),
    emit: jest.fn(),
    handshake: {
      query: {
        subject: "sample",
        token: "sample-token",
      },
    },
    id: 0,
    join: jest.fn(),
    on: jest.fn(),
  },

  httpServer: jest.fn(),
};

/**
 * Mocks
 */
jest.genMockFromModule("redis");

jest.mock("socket.io", () => {
  return () => mockConfig.socketIO;
});

jest.mock("uuid/v4", () => {
  return () => mockConfig.uuid;
});

jest.mock("@dojot/dojot-module", () => ({
  Messenger: jest.fn(() => mockConfig.Messenger),
}));

jest.mock("../src/FilterManager", () => ({
  FilterManager: jest.fn(() => mockConfig.FilterManager),
}));

jest.mock("../src/RedisClientWrapper", () => ({
  ClientWrapper: jest.fn(() => mockConfig.ClientWrapper),
}));

jest.mock("../src/topicManager", () => ({
  TopicManager: jest.fn(() => mockConfig.TopicManager),
}));

describe("SocketIOHandler", () => {
  const messengerName = "testMessenger";
  const testTenant = "sample-tenant";
  const testToken = "sample-uuid";
  const testSubject = "device-data";
  const testTopic = "sample-topic";
  const testError = "generic-error";
  const testKey = `si:${testToken}`;
  const testSuccess =  "sample-success";
  const testFailure =  "sample-failure";

  let obj: SocketIOHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    obj = new SocketIOHandler(mockConfig.httpServer, new Messenger(messengerName));
  });

  it("should build an empty handler", (done) => {
    mockConfig.Messenger.init.mockReturnValue(Promise.reject("reasons"));
    process.kill = jest.fn(() => {
      // Avoid application crash!
    });
    obj.processNewSocketIo = jest.fn();
    expect(obj).toBeDefined();
    expect(mockConfig.socketIO.use).toBeCalled();
    expect(mockConfig.socketIO.on).toHaveBeenCalledTimes(1);
    const [event, ioCbk] = mockConfig.socketIO.on.mock.calls[0];
    expect(event).toEqual("connection");

    // Running ioserver callback
    ioCbk(mockConfig.socketSample);
    expect(mockConfig.ClientWrapper.runScript).toBeCalledTimes(1);
    const [script, keys, vals, redisCbk] = mockConfig.ClientWrapper.runScript.mock.calls[0];
    expect(script).toEqual(expect.stringContaining("/lua/setDel.lua"));
    expect(keys).toEqual(["si:sample-token"]);
    expect(vals).toEqual([]);

    // Testing redis callbacks
    redisCbk(null, "sample-tenant");
    expect(obj.processNewSocketIo).toHaveBeenCalled();
    redisCbk("error", "sample-tenant");
    expect(mockConfig.socketSample.disconnect).toBeCalledTimes(1);
    done();
  });

  it("should process a new regular socket.io connection", () => {
    obj.registerSocketIoNotification = jest.fn();
    mockConfig.socketSample.handshake.query.subject = "sample-subject";
    obj.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
    expect(mockConfig.socketSample.join).toHaveBeenCalled();
    expect(obj.registerSocketIoNotification).not.toHaveBeenCalled();
  });

  it("should process a new notification socket.io connection", () => {
    obj.registerSocketIoNotification = jest.fn();
    mockConfig.socketSample.handshake.query.subject = "dojot.notifications";
    obj.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
    expect(mockConfig.socketSample.join).not.toHaveBeenCalled();
    expect(obj.registerSocketIoNotification).toHaveBeenCalled();
  });

  it("should register a new notification socket.io connection", () => {
    mockConfig.FilterManager.checkFilter.mockReturnValue(true);
    obj.registerSocketIoNotification(mockConfig.socketSample as any, "sample-tenant");
    expect(mockConfig.Messenger.on).toHaveBeenCalled();
    const [subject, event, onCbk] = mockConfig.Messenger.on.mock.calls[2];
    expect(subject).toEqual("dojot.notifications");
    expect(event).toEqual("message");
    onCbk("sample-tenant", "sample-msg");
    expect(mockConfig.FilterManager.checkFilter).toBeCalled();
    expect(mockConfig.socketSample.emit).toHaveBeenCalled();

    let [sioEvent, sioCbk] = mockConfig.socketSample.on.mock.calls[0];
    expect(sioEvent).toEqual("filter");
    sioCbk("{}");
    expect(mockConfig.FilterManager.update).toHaveBeenCalled();

    [sioEvent, sioCbk] = mockConfig.socketSample.on.mock.calls[1];
    expect(sioEvent).toEqual("disconnect");
    sioCbk();
    expect(
      mockConfig.Messenger.unregisterCallback,
    ).toHaveBeenCalledWith(
      "dojot.notifications",
      "message",
      mockConfig.socketSample.id,
    );

    // Clearing mocks for alternate unit tests
    // "Publishing" messages in different tenant
    mockConfig.socketSample.emit.mockClear();
    mockConfig.FilterManager.checkFilter.mockClear();
    onCbk("sample-tenant-2", "sample-msg");
    expect(mockConfig.FilterManager.checkFilter).not.toHaveBeenCalled();
    expect(mockConfig.socketSample.emit).not.toHaveBeenCalled();

    mockConfig.socketSample.emit.mockClear();
    mockConfig.FilterManager.checkFilter.mockClear();

    // Publishing messages that do not match any filter.
    mockConfig.FilterManager.checkFilter.mockReturnValue(false);
    onCbk("sample-tenant", "sample-msg");
    expect(mockConfig.FilterManager.checkFilter).toHaveBeenCalled();
    expect(mockConfig.socketSample.emit).not.toHaveBeenCalled();
  });

  it("should register a new actuator socket.io connection", () => {
    mockConfig.socketSample.handshake.query.subject = "dojot.device-manager.device";
    obj.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
    expect(mockConfig.socketSample.join).toBeCalled();

    expect(mockConfig.Messenger.on).toHaveBeenCalled();
    const [subject, event, onCbk] = mockConfig.Messenger.on.mock.calls[1];
    expect(subject).toEqual("dojot.device-manager.device");
    expect(event).toEqual("message");
    onCbk("sample-tenant", JSON.stringify({
      data: {
        attrs: {
          target_temperature: 23.5,
        },
        id: "efac",
      },
      event: "configure",
      meta: {
        service: "sample-tenant",
        timestamp: 0,
      },
    }));

    expect(mockConfig.FilterManager.checkFilter).not.toBeCalled();
    expect(mockConfig.socketIO.to).toBeCalled();

  });

  it("should register a new device-data socket.io connection", () => {
    mockConfig.socketSample.handshake.query.subject = "device-data";
    obj.processNewSocketIo(mockConfig.socketSample as any, "sample-tenant");
    expect(mockConfig.socketSample.join).toBeCalled();

    expect(mockConfig.Messenger.on).toHaveBeenCalled();
    const [subject, event, onCbk] = mockConfig.Messenger.on.mock.calls[0];
    expect(subject).toEqual("device-data");
    expect(event).toEqual("message");
    onCbk("sample-tenant", JSON.stringify({
      attrs: {
        humidity: 60,
      },
      metadata: {
        deviceid: "c6ea4b",
        tenant: "admin",
        timestamp: 1528226137452,
      },
    }));

    expect(mockConfig.FilterManager.checkFilter).not.toBeCalled();
    expect(mockConfig.socketIO.to).toBeCalled();

  });

  it("should get a token", (done) => {
    const token = obj.getToken(testTenant);

    expect(token).toEqual(testToken);

    // Retrieve getCreateTopic call
    expect(mockConfig.TopicManager.getCreateTopic).toBeCalledTimes(1);
    const [subject, cbk] = mockConfig.TopicManager.getCreateTopic.mock.calls[0];
    expect(subject).toEqual(testSubject);

    // Calling callback when the topic is retrieved
    cbk(undefined, testTopic);

    // Calling callback when the topic is retrieved
    cbk(testError);

    // Retrieve redis calls
    expect(mockConfig.ClientWrapper.client.setex).toBeCalledTimes(1);
    const [key, time, tenant] = mockConfig.ClientWrapper.client.setex.mock.calls[0];
    expect(key).toEqual(testKey);
    expect(time).toEqual(60);
    expect(tenant).toEqual(testTenant);
    done();
  });

  describe("handleMessage", () => {
    let stripped: any;
    let testMessage: any;

    beforeEach(() => {
      stripped = (obj as any);
      testMessage = undefined;
    });

    it("should handle a complete message", () => {
      testMessage = {
        attrs: {
          humidity: 60,
        },
        metadata: {
          deviceid: "c6ea4b",
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).toHaveBeenCalledTimes(2);
    });

    it("should not handle an incomplete message", () => {
      // without metadata
      testMessage = {
        attrs: {
          humidity: 60,
        },
        meta: {
          deviceid: "c6ea4b",
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // metadata without deviceid
      testMessage = {
        attrs: {
          humidity: 60,
        },
        metadata: {
          tenant: "admin",
          timestamp: 1528226137452,
        },
      };
      stripped.handleMessage(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // invalid message
      testMessage = {};
      stripped.handleMessage(testTenant, testMessage);
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });
  });

  describe("handleMessageActuator", () => {
    let stripped: any;
    let testMessage: any;

    beforeEach(() => {
      stripped = (obj as any);
      testMessage = undefined;
    });

    it("should handle a complete actuation message", () => {
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).toHaveBeenCalledTimes(2);
    });

    it("should not handle an invalid actuation message", () => {
      testMessage = {};
      stripped.handleMessageActuator(testTenant, testMessage);
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property event", () => {
      // event is not configure
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "not-configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without event
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property meta", () => {
      // without service
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without timestamp
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without meta
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
          id: "efac",
        },
        event: "configure",
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });

    it("should not handle an incomplete actuation message - property data", () => {
      // without id
      testMessage = {
        data: {
          attrs: {
            target_temperature: 23.5,
          },
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without attrs
      testMessage = {
        data: {
          id: "efac",
        },
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
      mockConfig.socketIO.to.mockClear();

      // without data
      testMessage = {
        event: "configure",
        meta: {
          service: "sample-tenant",
          timestamp: 0,
        },
      };
      stripped.handleMessageActuator(testTenant, JSON.stringify(testMessage));
      expect(mockConfig.socketIO.to).not.toHaveBeenCalled();
    });
  });

  describe("checkSocket", () => {
    const next = jest.fn((error?: Error) => {
      if (error) {
        throw new Error(testError);
      }
      return testSuccess;
    });

    let stripped: any;
    let socket: any;

    beforeEach(() => {
      stripped = (obj as any);
      socket = undefined;
    });

    it("should succeed checking a socket", () => {
      socket = {
        handshake: {
          query: {
            token: testToken,
          },
        },
      };
      cbError = null;
      cbReply = `${testSuccess}-callback`;

      expect(() => stripped.checkSocket(socket, next)).not.toThrow();
    });

    it("should not succeed checking a socket", () => {
      /* without token */
      socket = {
        handshake: {
          query: {},
        },
      };
      cbError = null;
      cbReply = `${testSuccess}-callback`;

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* redis.client.get returns error */
      socket = {
        handshake: {
          query: {
            token: testToken,
          },
        },
      };
      cbError = new Error();
      cbReply = testFailure;

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* redis.client.get returns invalid token */
      cbError = null;
      cbReply = "";

      expect(() => stripped.checkSocket(socket, next)).toThrow();

      /* invalid socket */
      socket = undefined;
      expect(() => stripped.checkSocket(socket, next)).toThrow();
    });
  });
});
