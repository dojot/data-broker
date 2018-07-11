/* jslint node: true */
"use strict";

import { Event } from "./Event";

interface INotificationSpec {
  attrs: string[];
  receiver: any;
  topic: string;
}

interface ICondition {
  attrs?: string[];
  expression: {
    coords?: string[];
    geometry?: "point" | "polygon";
    georel?: "convered-by" | "intersects";
    mq?: string;
    q: string;
  };
}

interface ISubscription {
  /** Subscription ID */
  id: string;

  /** Which resource will trigger this subcription */
  subject: {
    entities: {
      /** Specific device ID */
      id?: string;
      /** Specific device template ID */
      template?: string;
    };

    /** Which condition this subscription will be triggered */
    condition?: ICondition;
  };

  /**
   * Specification of the notification generated when this subscription is
   * triggered.
   */
  notification: INotificationSpec;

}

interface INotification {
  topic: string;
  data: Event;
}

function assertSubscription(subscription: ISubscription): [number, string] {
  if (subscription.subject === undefined) {
    return [-1, "missing subject"];
  }
  if (subscription.subject.entities === undefined) {
    return [-1, "missing entity specification"];
  }
  if (subscription.subject.entities.id === undefined &&
      subscription.subject.entities.template === undefined) {
    return [-1, "missing entitie specification"];
  }
  if (subscription.notification === undefined) {
    return [-1, "missing notification specification"];
  }

  if (subscription.subject.condition !== undefined) {
    const condition = subscription.subject.condition;
    if (condition.attrs === undefined) {
      return [-1, "condition was defined, but no attrs were specified"];
    }
  }

  return [0, "ok"];
}

export { INotificationSpec, ISubscription, ICondition, INotification };
export { assertSubscription };
