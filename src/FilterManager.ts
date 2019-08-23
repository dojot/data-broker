"use strict";
import { logger } from "@dojot/dojot-module-logger";

const TAG = { filename: "FilterManager" };

export interface INotification {
  msgId: any;
  timestamp: any;
  metaAttrsFilter: {
    [filter: string]: any;
  };
  message: any;
  subject: string;
}

class FilterManager {
  private operationsMap: any;
  private filters: any;

  constructor() {
    // arg1: arg that came on notification
    // arg2: arg on the filter
    this.operationsMap = {
      "!=": (arg1: any, arg2: any) => {
        logger.debug("!= operation", TAG);
        return arg1 !== arg2 ? true : false;
      },
      "<": (arg1: number, arg2: number) => {
        logger.debug("< operation", TAG);
        return arg1 < arg2 ? true : false;
      },
      "=": (arg1: any, arg2: any) => {
        logger.debug("= operation", TAG);
        return arg1 === arg2 ? true : false;
      },
      ">": (arg1: number, arg2: number) => {
        logger.debug("> operation", TAG);
        return arg1 > arg2 ? true : false;
      },
    };

    this.filters = {};
  }

  /**
   * The operation that was registered in the filter will be applied over two arguments given
   * @param {*} operation
   * @param {*} arg1
   * @param {*} arg2
   */
  public applyOperation(operation: string, arg1: any, arg2: any) {
    logger.debug("Gonna apply operation", TAG);
    return this.operationsMap[operation](arg1, arg2);
  }

  public update(filter: any, socketId: string) {
    logger.debug(`Registering new filter for socket ${socketId}`, TAG);

    this.filters[socketId] = filter;
    logger.debug(`Displaying current filters map: ${JSON.stringify(this.filters)}`, TAG);

  }

  public removeFilter(socketId: string) {
    delete this.filters[socketId];
  }

  /**
   * Apply the connection filter to the message to check if it will be forward to the application by SocketIO
   * @param {string} msg
   */
  public checkFilter(msg: string, socketId: string) {
    logger.debug("Checking filter", TAG);
    let retOperation;
    const notification: INotification = JSON.parse(msg);
    if (this.filters.hasOwnProperty(socketId)) {
      for (const key in this.filters[socketId].fields) {
        if (this.filters[socketId].fields.hasOwnProperty(key)) {
          if (key === "subject") {
            if (notification.hasOwnProperty("subject")) {
              retOperation = this.applyOperation(this.filters[socketId].fields.subject.operation,
                notification.subject, this.filters[socketId].fields.subject.value);
              logger.debug(`Return from operation over field subject is ${retOperation}`, TAG);
              if (!retOperation) {
                return retOperation;
              }
            }
          } else {
            if (notification.metaAttrsFilter.hasOwnProperty(key)) {
              retOperation = this.applyOperation(this.filters[socketId].fields[key].operation,
                notification.metaAttrsFilter[key], this.filters[socketId].fields[key].value);
              logger.debug(`Return from operation over field ${key} is ${retOperation}`, TAG);
              if (!retOperation) {
                return retOperation;
              }
            }
          }
        }
      }
    }
    return true;
  }

}

export { FilterManager };
