"use strict";

import { Messenger } from "@dojot/dojot-module";
import "jest";
import { SocketIOSingleton } from "../src/socketIo";

jest.mock("../src/SocketIOHandler", (httpServer: any, messenger: Messenger) => ({
  SocketIOHandler: jest.fn(() => ({
    checkSocket: jest.fn(),
    getToken: jest.fn(),
    handleMessage: jest.fn(),
    handleMessageActuator: jest.fn(),
    processNewSocketIo: jest.fn(),
    registerSocketIoNotification: jest.fn(),
  })),
}));

jest.mock("@dojot/dojot-module", () => ({
  Messenger: jest.fn(() => ({
    on: jest.fn(),
  })),
}));

describe("SocketIOSingleton", () => {
  const stripped: any = (SocketIOSingleton as any);
  const serverName: string = "testServer";
  const messenger: Messenger = new Messenger("testMessenger");

  describe("constructor", () => {
    it("should be defined", () => {
      expect(SocketIOSingleton).toBeDefined();
      expect(stripped.handler).toBe(null);
    });
  });

  describe("getInstance", () => {
    it("should not get a server instance - without httpServer", () => {
      expect(() => SocketIOSingleton.getInstance(undefined, messenger)).toThrow();
    });

    it("should not get a server instance - without messenger", () => {
      expect(() => SocketIOSingleton.getInstance(serverName, undefined)).toThrow();
    });

    it ("should get a server instance - create a new", () => {
      const server = SocketIOSingleton.getInstance(serverName, messenger);
      expect(server).toBeDefined();
    });

    it("should get a server instance - retrieve an already created", () => {
      const server = SocketIOSingleton.getInstance(serverName, messenger);
      expect(server).toBeDefined();
    });
  });
});
