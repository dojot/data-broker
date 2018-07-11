/* jslint node: true */
"use strict";

import {SocketIOHandler } from "./SocketIOHandler";

class SocketIOSingletonImpl {
  private handler: SocketIOHandler | null;

  constructor() {
    this.handler = null;
  }

  public getInstance(httpServer?: any) {
    if (this.handler != null) {
      return this.handler;
    }

    if (httpServer) {
      this.handler = new SocketIOHandler(httpServer);
      return this.handler;
    }

    throw new Error("Failed to instantiate socketio server");
  }
}

const SocketIOSingleton = new SocketIOSingletonImpl();

export { SocketIOSingleton };
