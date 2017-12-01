import kafka = require('kafka-node');
import config = require('./config');

class Context {
  client: kafka.Client;

  constructor(obj: kafka.Client) {
    this.client = obj;
  }
}

function createContext(clientId: string) : Context {
  let context = new kafka.Client(config.kafka.zookeeper, clientId);
  return new Context(context);
}

function init(context: Context, topics: kafka.Topic[], initCb: (data: kafka.Message) => void) : void {
  let consumer = new kafka.HighLevelConsumer(context.client, topics, config.kafka.consumer);

  // Register callbacks
  consumer.on('message', function (message) {
    initCb(message);
  });

  consumer.on('error', function (err) {
    console.log('error', err);
  });
}


export {createContext};
export {init};
export {Context};
