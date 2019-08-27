import { Messenger } from "@dojot/dojot-module";
import { logger } from "@dojot/dojot-module-logger";
import { DataTrigger, getHTTPRouter, HealthChecker, IComponentDetails, IServiceInfo } from "@dojot/healthcheck";
import { Router } from "express";
import * as os from "os";
import { RedisClient } from "redis";
import pjson from "../package.json";
import * as config from "./config";

const TAG = { filename: "HealthCheck" };

/**
 * Healthcheck agent for IoT agent MQTT.
 *
 * This class is responsible for monitoring all important internal states,
 * connections to services and resources used (CPU and memory)
 */
class AgentHealthChecker {
  public router: Router;
  private healthChecker: HealthChecker;
  private kafkaMessenger: Messenger;
  private redisClient: RedisClient;

  constructor(kafkaMessenger: Messenger, redisClient: RedisClient) {
    const configHealth: IServiceInfo = {
      description: "Health status for DataBroker",
      status: "pass",
      version: pjson.version,
    };

    this.healthChecker = new HealthChecker(configHealth);
    logger.debug("Initializing HTTP Router...", TAG);
    this.router = getHTTPRouter(this.healthChecker);
    logger.debug("... HTTP Router initialized", TAG);
    this.kafkaMessenger = kafkaMessenger;
    this.redisClient = redisClient;
  }

  /**
   * Register all monitors
   */
  public init() {
    this._registerUptimeMonitor();
    this._registerMemoryMonitor();
    this._registerCpuMonitor();
    this._registerKafkaMonitor();
    this._registerRedisMonitor();
  }

  private _registerUptimeMonitor() {
    // uptime
    const uptime: IComponentDetails = {
      componentType: "system",
      measurementName: "uptime",
      observedUnit: "s",
      status: "pass",
    };

    const collectUptime = (trigger: DataTrigger) => {
      const value = Math.floor(process.uptime());
      trigger.trigger(value, "pass");
      return value;
    };

    logger.debug("Registering uptime monitor", TAG);
    this.healthChecker.registerMonitor(uptime, collectUptime,
      config.healthcheck.timeout.uptime);
  }

  private _registerMemoryMonitor() {
    const memory: IComponentDetails = {
      componentName: "memory",
      componentType: "system",
      measurementName: "utilization",
      observedUnit: "percent",
      status: "pass",
    };

    const collectMemory = (trigger: DataTrigger) => {
      const tmem = os.totalmem();
      const fmem = os.freemem();
      const pmem = Number((100 - (fmem / tmem) * 100).toFixed(2));
      if (pmem > 75) {
        trigger.trigger(pmem, "warn");
      } else {
        trigger.trigger(pmem, "pass");
      }
      return pmem;
    };

    logger.debug("Registering memory monitor", TAG);
    this.healthChecker.registerMonitor(memory, collectMemory,
      config.healthcheck.timeout.memory);
  }

  private _registerCpuMonitor() {
    const cpu: IComponentDetails = {
      componentName: "cpu",
      componentType: "system",
      measurementName: "utilization",
      observedUnit: "percent",
      status: "pass",
    };

    const collectCpu = (trigger: DataTrigger) => {
      const ncpu = os.cpus().length;
      const lcpu = os.loadavg()[1]; // last five minute
      const pcpu = Number((100 * lcpu / ncpu).toFixed(2));
      if (pcpu > 75) {
        trigger.trigger(pcpu, "warn");
      } else {
        trigger.trigger(pcpu, "pass");
      }
      return pcpu;
    };

    logger.debug("Registering CPU monitor", TAG);
    this.healthChecker.registerMonitor(cpu, collectCpu,
      config.healthcheck.timeout.cpu);
  }

  private _registerRedisMonitor() {
    const redisInfo: IComponentDetails = {
      componentName: "redis",
      componentType: "datastore",
      measurementName: "accessibility",
      observedUnit: "boolean",
      status: "pass",
    };

    logger.debug("Registering Redis monitor", TAG);
    const dataTrigger = this.healthChecker.registerMonitor(redisInfo);
    this.redisClient.on("ready", () => {
      logger.debug("Redis server connected", TAG);
      dataTrigger.trigger(true, "pass");
    });

    this.redisClient.on("end", () => {
      logger.debug("Redis server connection has closed", TAG);
      dataTrigger.trigger(false, "fail");
    });
  }

  private _getKafkaStatus() {
    return new Promise((resolve, reject) => {
      const kafkaStatus = {
        connected: false,
        details: {},
      };

      // It can be the consumer or the producer because the returned value is the same.
      (this.kafkaMessenger as any).consumer.consumer.getMetadata({ timeout: 3000 },
        (error: any, metadata: any) => {
          if (error) {
            logger.error(`Kafka has errored while getting metadata: ${error}`, TAG);
            reject(error);
          } else {
            kafkaStatus.connected = true;
            kafkaStatus.details = {
              metadata,
            };
            resolve(kafkaStatus);
          }
        });
    });
  }

  private _registerKafkaMonitor() {
    const kafka: IComponentDetails = {
      componentName: "kafka",
      componentType: "datastore",
      measurementName: "accessibility",
      observedUnit: "boolean",
      status: "pass",
    };
    const collectKafkaState = (trigger: DataTrigger) => {
      return this._getKafkaStatus().then((status: any) => {
        if (status.connected) {
          trigger.trigger(1 /*one connection */, "pass");
        } else {
          trigger.trigger(0 /* zero connection */, "fail");
        }
      }).catch((error: string) => {
        trigger.trigger(0 /* zero connection */, "fail", error);
      });
    };

    logger.debug("Registering Kafka monitor", TAG);
    this.healthChecker.registerMonitor(kafka, collectKafkaState,
      config.healthcheck.timeout.kafka);

  }
}

export { AgentHealthChecker };
