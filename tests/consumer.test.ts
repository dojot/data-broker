import "jest";
import kafka = require("kafka-node");
import * as config from "../src/config";
import { KafkaConsumer } from "../src/consumer";

function buildDefaultConfig(): [string, string, any] {
    const clientid = "mocha-tests";
    const host = "mocha-kafka";
    const info = {
        autoCommit: true,
        extra: "mocha-extra-parameter",
        fetchMaxBytes: 1,
        fetchMaxWaitMs: 2,
        group: "mocha-test-group",
        id: "mocha-consumer-id",
    };
    return [clientid, host, info];
}

describe("Consumer", () => {
    it ("should build an default Consumer", (done) => {
        const obj = new KafkaConsumer();
        const strippedObj = (obj as any);
        expect(strippedObj.host).toEqual("kafka:9092");
        expect(strippedObj.info).toEqual(config.kafka.consumer);
        expect(strippedObj.id).toEqual(undefined);
        done();
    });
    it ("should build a Consumer with values", (done) => {
        const [clientid, host, info] = buildDefaultConfig();
        const obj = new KafkaConsumer(clientid, host, info);
        const strippedObj = (obj as any);
        expect(strippedObj.host).toEqual("mocha-kafka");
        expect(strippedObj.info.autoCommit).toEqual(true);
        expect(strippedObj.info.extra).toEqual("mocha-extra-parameter");
        expect(strippedObj.info.fetchMaxBytes).toEqual(1);
        expect(strippedObj.info.fetchMaxWaitMs).toEqual(2);
        expect(strippedObj.info.group).toEqual("mocha-test-group");
        expect(strippedObj.info.id).toEqual("mocha-consumer-id");
        expect(strippedObj.id).toEqual("mocha-tests");
        done();
    });
    it ("should subscribe to topics - with a callback", (done) => {
        const kafkaConsumerGroupFn = kafka.ConsumerGroup;
        const kafkaMock = jest.fn();
        const messageOnCbk = jest.fn();
        kafkaMock.mockImplementation(() => {
            return {on: messageOnCbk};
        });
        kafka.ConsumerGroup = kafkaMock as any;

        const [clientid, host, info] = buildDefaultConfig();
        const obj = new KafkaConsumer(clientid, host, info);
        const topic = "mocha-test-topic";
        const cbk = jest.fn();
        obj.subscribe([{topic}], cbk);

        expect(messageOnCbk).toHaveBeenCalledWith("message", expect.any(Function));
        expect(messageOnCbk).toHaveBeenCalledWith("error", expect.any(Function));
        expect(messageOnCbk).toHaveBeenCalledTimes(2);

        // Faking events
        const cbkMessage = messageOnCbk.mock.calls[0][1];
        cbkMessage("dummy-message");
        expect(cbk).toHaveBeenCalledWith(undefined, "dummy-message");

        const cbkError = messageOnCbk.mock.calls[1][1];
        cbkError("dummy-error");
        expect(cbk).toHaveBeenCalledWith("dummy-error");

        // Restoring original implementation
        kafka.ConsumerGroup = kafkaConsumerGroupFn;
        done();
    });

    it ("should subscribe to topics - without a callback", (done) => {
        const kafkaConsumerGroupFn = kafka.ConsumerGroup;
        const kafkaMock = jest.fn();
        const messageOnCbk = jest.fn();
        kafkaMock.mockImplementation(() => {
            return {on: messageOnCbk};
        });
        kafka.ConsumerGroup = kafkaMock as any;

        const [clientid, host, info] = buildDefaultConfig();
        const obj = new KafkaConsumer(clientid, host, info);
        const topic = "mocha-test-topic";
        const cbk = jest.fn();
        obj.subscribe([{topic}]);

        expect(messageOnCbk).toHaveBeenCalledWith("message", expect.any(Function));
        expect(messageOnCbk).toHaveBeenCalledWith("error", expect.any(Function));
        expect(messageOnCbk).toHaveBeenCalledTimes(2);

        // Faking events
        const cbkMessage = messageOnCbk.mock.calls[0][1];
        cbkMessage("dummy-message");
        expect(cbk).toHaveBeenCalledTimes(0);

        const cbkError = messageOnCbk.mock.calls[1][1];
        cbkError("dummy-error");
        expect(cbk).toHaveBeenCalledTimes(0);

        // Restoring original implementation
        kafka.ConsumerGroup = kafkaConsumerGroupFn;
        done();
    });
});
