import "jest";
import redis = require("redis");

const redisCreateClientOrigFn = redis.createClient;
redis.createClient = jest.fn();

import { RedisManager } from "../src/redisManager";
import { SocketIOHandler } from "../src/SocketIOHandler";
import { TopicManagerBuilder } from "../src/TopicBuilder";

// There should be an easier way to implement these tests.
// But, for now, this is working as expected.
const mockTestConfig = {
    getClientFn: jest.fn(),
    getClientOrigFn: RedisManager.getClient,
    getCreateTopicFn: jest.fn(),
    getTopicManagerBuilderFn: jest.fn(),
    getTopicManagerBuilderOrigFn: TopicManagerBuilder.get,
    ioServerOnFn: jest.fn(),
    ioServerUseFn: jest.fn(),
    redisRunScriptFn: jest.fn(),
    redisSetEx: jest.fn(),
    socketSample: {
        disconnect: jest.fn(),
        handshake: {
            query: {
                token: "sample-token",
            },
        },
        join: jest.fn(),
    },
};

jest.mock("socket.io", () => {
    return () => {
        return  {
            on: mockTestConfig.ioServerOnFn,
            use: mockTestConfig.ioServerUseFn,
        };
    };
});

jest.mock("uuid/v4", () => {
    return () => "sample-uuid";
});

jest.mock("../src/consumer");
import consumer = require("../src/consumer");

beforeAll(() => {
    mockTestConfig.getClientFn.mockImplementation(() => {
        return {
            client: {
                setex: mockTestConfig.redisSetEx,
            },
            runScript: mockTestConfig.redisRunScriptFn,
        };
    });
    mockTestConfig.getTopicManagerBuilderFn.mockImplementation(() => {
        return {
            getCreateTopic: mockTestConfig.getCreateTopicFn,
        };
    });
});

beforeEach(() => {
    mockTestConfig.ioServerOnFn.mockClear();
    mockTestConfig.ioServerUseFn.mockClear();
    mockTestConfig.getClientFn.mockClear();
    mockTestConfig.getTopicManagerBuilderFn.mockClear();
    mockTestConfig.getCreateTopicFn.mockClear();
    mockTestConfig.redisSetEx.mockClear();
    RedisManager.getClient = mockTestConfig.getClientFn;
    TopicManagerBuilder.get = mockTestConfig.getTopicManagerBuilderFn;
});

afterEach(() => {
    RedisManager.getClient = mockTestConfig.getClientOrigFn;
    TopicManagerBuilder.get = mockTestConfig.getTopicManagerBuilderOrigFn;
    redis.createClient = redisCreateClientOrigFn;
});

describe("SocketIOHandler", () => {
    it("should build an empty handler", (done) => {
        const httpServerMock = jest.fn();
        const obj = new SocketIOHandler(httpServerMock);
        expect(mockTestConfig.ioServerUseFn).toBeCalled();
        expect(mockTestConfig.ioServerOnFn).toHaveBeenCalledTimes(1);
        const [event, ioCbk] = mockTestConfig.ioServerOnFn.mock.calls[0];
        expect(event).toEqual("connection");
        // Running ioserver callback
        ioCbk(mockTestConfig.socketSample);
        expect(mockTestConfig.redisRunScriptFn).toBeCalledTimes(1);
        const [script, keys, vals, redisCbk] = mockTestConfig.redisRunScriptFn.mock.calls[0];
        expect(script).toEqual(expect.stringContaining("/lua/setDel.lua"));
        expect(keys).toEqual(["si:sample-token"]);
        expect(vals).toEqual([]);
        // Testing redis callbacks
        redisCbk(null, "sample-tenant");
        expect(mockTestConfig.socketSample.join).toBeCalledTimes(1);
        expect(mockTestConfig.socketSample.join).toBeCalledWith("sample-tenant");
        redisCbk("error", "sample-tenant");
        expect(mockTestConfig.socketSample.disconnect).toBeCalledTimes(1);
        done();
    });

    it("should get a token", (done) => {
        const obj = new SocketIOHandler({});
        const token = obj.getToken("sample-tenant");

        // Retrieve getCreateTopic call
        expect(mockTestConfig.getCreateTopicFn).toBeCalledTimes(1);
        const [subject, cbk] = mockTestConfig.getCreateTopicFn.mock.calls[0];
        expect(subject).toEqual("device-data");

        // Calling callback when the topic is retrieved
        cbk(undefined, "sample-topic");

        // Calling callback when the topic is retrieved
        cbk("generic-error");

        // Retrieve redis calls
        expect(mockTestConfig.redisSetEx).toBeCalledTimes(1);
        const [key, time, tenant] = mockTestConfig.redisSetEx.mock.calls[0];
        expect(key).toEqual("si:sample-uuid");
        expect(time).toEqual(60);
        expect(tenant).toEqual("sample-tenant");
        done();
    });
});
