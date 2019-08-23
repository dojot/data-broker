import { QueuedTopic } from "../src/QueuedTopic";

describe("QueuedTopic", () => {
  it("should build an empty QueuedTopic", (done) => {
    const obj = new QueuedTopic();
    expect(obj.subject).toBe("");
    expect(obj.topic).toBe("");
    expect(obj.callback).toBe(undefined);
    done();
  });
});
