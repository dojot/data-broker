/* jslint node: true */
"use strict";

import kafka = require("kafka-node");
import util = require("util");
import { KafkaConsumer } from "./consumer";
import { logger } from "./logger";
import { KafkaProducer } from "./producer";
import tools = require("./simple-tools");

import { Event } from "./subscription/Event";
import { INotification, INotificationSpec, ISubscription } from "./subscription/Types";
import { TopicManagerBuilder } from "./TopicBuilder";

// Now this is awful, but
enum SubscriptionType {
  template = "template",
  id = "id",
  flat = "flat",
}

interface ISubscriptionMap {
  [key: string]: any;
}

interface IRegisteredSubscriptions {
  // This will allow "invalid" types on indirect access to attributes, but we need it for
  // the compiler to allow indirect (e.g. var[valuePointer] ) attribute reading/writing
  [k: string]: ISubscriptionMap;
  flat: ISubscriptionMap;
  id: ISubscriptionMap;
  template: ISubscriptionMap;
}

const operators = ["==", "!=", ">=", "<=", "~=", ">", "<" ];

function evaluateLogicTest(op1: any, operator: string, op2: string): boolean {
  logger.debug(`Evaluating logic test: ${op1} ${operator} ${op2}.`);
  // There"s something here
  switch (operator) {
    case "==":
      return (op1 === op2);
    case "!=":
      return (op1 !== op2);
    case ">":
      return (op1 > parseFloat(op2));
    case ">=":
      return (op1 >= parseFloat(op2));
    case "<":
      return (op1 < parseFloat(op2));
    case "<=":
      return (op1 <= parseFloat(op2));
    case "~=":
      // ret = (logicTokens[1].exec(data[logicTokens[0]].value).length != 0);
  }
  return false;
}

function evaluateLogicCondition(condition: string, data: any) {
  logger.debug("Evaluating logic condition...");
  let ret = true;

  const logicTests = tools.tokenize(condition, ";");

  for (const logicTest of logicTests) {
    for (const operator of operators) {
      const logicTokens = tools.tokenize(logicTest, operator);
      if (logicTokens.length <= 1) {
        continue;
      }
      ret = evaluateLogicTest(data[logicTokens[0]], operator, logicTokens[1]);
      logger.debug(`Condition evaluation result so far: ${ret}.`);
      if (ret === false) {
        break;
      }
    }
    if (ret === false) {
      break;
    }
  }

  logger.debug("... logic condition was evaluated.");
  return ret;
}

function evaluateMetaCondition(condition: string, data: any) {
  const ret = true;
  logger.debug("Evaluation of meta-data is not yet implemented.");
  logger.debug("Parameters are:");
  logger.debug(`Condition: ${condition}`);
  logger.debug(`Data: ${util.inspect(data, { depth: null})}`);
  return ret;
}

function evaluateGeoCondition(georel: string, geometry: string, coords: string, data: any) {
  const ret = true;
  logger.debug("Evaluation of meta-data is not yet implemented.");
  logger.debug("Parameters are:");
  logger.debug(`georel: ${georel}`);
  logger.debug(`geometry: ${geometry}`);
  logger.debug(`coords: ${coords}`);
  logger.debug(`Data: ${util.inspect(data, { depth: null})}`);
  return ret;
}

function evaluateCondition(condition: any, data: any) {
  let ret = true;

  if ("q" in condition) {
    ret = ret && evaluateLogicCondition(condition.q, data);
  }

  if ("mq" in condition) {
    ret = ret && evaluateMetaCondition(condition.mq, data);
  }

  if ("georel" in condition) {
    ret = ret && evaluateGeoCondition(condition.georel, condition.geometry, condition.coords, data);
  }

  return ret;
}

function generateOutputData(obj: Event, notification: INotificationSpec): INotification {
  const ret: INotification = {
    data: new Event(obj),
    topic: notification.topic,
  };

  ret.data.attrs = {};

  // notification.attrs contains all the attributes that must be
  // forwarded to output.
  // obj.attrs contains all the data retrieved from the device

  for (const attr of notification.attrs) {
    if (attr in obj.attrs) {
      ret.data.attrs[attr] = obj.attrs[attr];
    }
  }

  ret.data.metadata.notif_receiver = notification.receiver;

  return ret;
}

function checkSubscriptions(obj: Event, subscriptions: ISubscription[]): INotification[] {
  const notifs: INotification[] = [];

  for (const subscription of subscriptions) {
    if (subscription.subject.condition !== undefined) {
      if (subscription.subject.condition.attrs !== undefined) {
        // This subscription has some associated attributes, let"s check them
        const subscAttrs = subscription.subject.condition.attrs;
        for (let j = 0; j < subscAttrs.length; j++) {
          if (subscription.subject.condition.attrs[j] in obj.attrs) {
            // This subscription should be evaluated;
            if (subscription.subject.condition.expression !== undefined) {
              // TODO Gather all data from the device - the condition might use a few
              // variables that were not registered with this subscription
              if (evaluateCondition(subscription.subject.condition.expression, obj.attrs)) {
                logger.debug(`I should send something to ${subscription.notification.topic}`);
                logger.debug("Because it matches subscription condition.");
                notifs.push(generateOutputData(obj, subscription.notification));
              }
            } else {
              // There is no condition to this subscription - it should be triggered
              logger.debug(`I should send something to ${subscription.notification.topic}`);
              logger.debug("Because subscription has no condition.");
              notifs.push(generateOutputData(obj, subscription.notification));
            }
            break;
          }
        }
      } else {
        // All attributes should evaluate this subscription
        logger.debug(`I should send something to ${subscription.notification.topic}`);
        logger.debug("Because all attributes must trigger this subscription.");
        notifs.push(generateOutputData(obj, subscription.notification));
      }
    } else {
      // This subscription will be triggered whenever a message is sent by this device
      logger.debug(`I should send something to ${subscription.notification.topic}`);
      logger.debug("Because all conditions should trigger this subscription.");
      notifs.push(generateOutputData(obj, subscription.notification));
    }
  }

  return notifs;
}

class SubscriptionEngine {
  private producer: KafkaProducer;
  private producerReady: boolean;

  private subscriber: KafkaConsumer;

  private registeredSubscriptions: IRegisteredSubscriptions;

  constructor() {
    logger.debug("Initializing subscription xys engine...");
    this.producerReady = false;
    this.producer = new KafkaProducer(undefined, () => {
      this.producerReady = true;
    });

    this.subscriber = new KafkaConsumer();

    this.handleEvent.bind(this);

    this.registeredSubscriptions = {
      flat: {},
      id: {},
      template: {},
    };
  }

  public handleEvent(err: any, message: kafka.Message | undefined) {
    if (err) {
      logger.error(`Subscriber reported error: ${err}`);
      return;
    }

    if (message === undefined) {
      logger.error("Received an empty message.");
      return;
    }

    if (this.producerReady === false) {
      logger.error("Got event before being ready to handle it, ignoring");
      return;
    }

    let data: string;
    logger.debug("New data arrived!");
    try {
      data = JSON.parse(message.value);
      logger.debug(`Data: ${util.inspect(data, {depth: null})}`);
      this.processEvent(new Event(data));
    } catch (err) {
      if (err instanceof TypeError) {
        logger.error(`Received data is not a valid event: ${message.value}`);
      } else if (err instanceof SyntaxError) {
        logger.error(`Failed to parse event as JSON: ${message.value}`);
      }
    }
  }

  public addSubscription(type: SubscriptionType, tenant: string, key: string, subscription: ISubscription) {
    logger.debug("Registering subscription...");
    this.registeredSubscriptions.flat[subscription.id] = subscription;
    if (!(key in this.registeredSubscriptions[type])) {
      this.registeredSubscriptions[type][key] = [];
    }
    this.registeredSubscriptions[type][key].push(subscription);
    logger.debug("... subscription was registered.");

    logger.debug("Adding a new ingestion channel (Kafka topic) for subscription...");
    const topicManager = TopicManagerBuilder.get(tenant);
    topicManager.getCreateTopic(
      "device-data",
      (err?: any, topic?: string) => {
        if (err || !topic) {
          logger.error(`Failed to find appropriate Kafka topic for tenant ${tenant}`);
          logger.error(`Error is: ${err}`);
          if (!topic) {
            logger.error("Error: topic not found.");
          }
          return;
        }
        logger.debug(`Adding new ingestion channel for service ${tenant}...`);
        logger.debug(`Topic is: ${topic}.`);
        this.subscribeTopic(topic, tenant);
        logger.debug(`Ingestion channel added.`);
      });
    logger.debug("... new ingestion channel (Kafka topic) creation was requested.");
  }

  private subscribeTopic(topic: string, tenant: string) {
    logger.debug(`Subscribing to topic ${topic} for service ${tenant}...`);
    this.subscriber.subscribe(
      [{ topic }],
      (error?: any, message?: kafka.Message) => {
        this.handleEvent(error, message);
      });

    logger.debug("... topic was successfully subscribed.");
  }

  private processEvent(obj: Event) {
    let subscriptions;
    let notifications: INotification[] = [];

    // Check whether there"s any subscriptions to this device id
    if (obj.metadata.deviceid in this.registeredSubscriptions.id) {
      logger.debug("There are subscriptions for this device ID");
      subscriptions = this.registeredSubscriptions.id[obj.metadata.deviceid];
      notifications = notifications.concat(checkSubscriptions(obj, subscriptions));
    }

    // Check whether there"s any subscriptions to this device type
    for (const templateId of obj.metadata.templates) {
      if (templateId in this.registeredSubscriptions.template) {
        logger.debug("There are subscriptions for this device template");
        subscriptions = this.registeredSubscriptions.template[templateId];
        notifications = notifications.concat(checkSubscriptions(obj, subscriptions));
      }
    }

    // Execute all actions
    for (const notification of notifications) {
      logger.debug(`Action is ${util.inspect(notification, { depth: null})}:`);
      logger.debug(`Sending message to topic ${notification.topic}:`);
      logger.debug(`Message is: ${util.inspect(notification.data, {depth: null})}`);
      this.producer.createTopics([notification.topic], (err: any) => {
        if (err !== null) {
          logger.error(`Could not create topic ${notification.topic}`);
          logger.error(`Error is ${err}`);
        } else {
          this.producer.send(JSON.stringify(notification.data), notification.topic);
        }
      });
    }
  }
}

export { SubscriptionType, SubscriptionEngine };
