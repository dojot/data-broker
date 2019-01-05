import { logger } from "@dojot/dojot-module-logger";
import "jest";
import { ClientWrapper, IAutoScheme, ITopicProfile } from "../src/RedisClientWrapper";

class RedisClientStub {
    public get: jest.Mock;
    public scan: jest.Mock;
    public select: jest.Mock;
    public set: jest.Mock;
    constructor() {
        this.get = jest.fn();
        this.scan = jest.fn();
        this.select = jest.fn();
        this.set = jest.fn();
    }
}
const redisStub = new RedisClientStub();
let clientWrapper: ClientWrapper;
beforeEach(() => {
    redisStub.get.mockClear();
    redisStub.scan.mockClear();
    redisStub.select.mockClear();
    redisStub.set.mockClear();
    clientWrapper = new ClientWrapper(redisStub as any);
});

describe("RedisClientWrapper", () => {
    it ("should build an empty Wrapper", (done) => {
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
            logger.debug("not   ok");
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
                logger.debug("not   ok");
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
            const [ , callback] = redisStub.get.mock.calls[0];
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
            const [ , callback] = redisStub.get.mock.calls[0];
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
                logger.debug("not   ok");
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
            const [ , callback] = redisStub.get.mock.calls[0];
            callback("generic-error");

            done();
        });
    });

    describe("Redis write acces", () => {
        it("should call Redis correctly", (done) => {
            clientWrapper.setConfig("test-key", "test-value");
            expect(redisStub.select).toBeCalledWith(1);
            expect(redisStub.set).toBeCalledWith("test-key", "test-value");
            done();
        });
    });
});
