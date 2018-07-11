const kafka = {
  consumer: {
    autoCommit : true,
    fetchMaxBytes : 1048576,
    fetchMaxWaitMs : 1000,
    group : "subscription-engine",
    id : "consumer-1",
  },
  kafka: process.env.DATABROKER_KAFKA_HOST || "kafka:9092",
  zookeeper: process.env.DATABROKER_ZOOKEEPER_HOST || "zookeeper:2181",
};

const broker = {
  ingestion: ["device-data", "device_data"],
};

const cache = {
  redis : process.env.DATABROKER_CACHE_HOST || "data-broker-redis",
};

export { kafka, broker, cache};
