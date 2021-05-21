/* jslint node: true */
"use strict";

import { authEnforce, authParse, IAuthRequest } from "../../src/api/authMiddleware";
import { InvalidTokenError } from "../../src/api/InvalidTokenError";
import { UnauthorizedError } from "../../src/api/UnauthorizedError";

import express = require("express");
import "jest";

/**
 * Variables
 */

/* Attributes of the token:
 * user: admin
 * service: admin
 */
const jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.\
eyJpc3MiOiJmdGFORTc0YUpSZm5WaU5sUHpKaEpQdjRGU05OcT\
EzQyIsImlhdCI6MTU2NjkyNDQ4NSwiZXhwIjoxNTY2OTI0OTA1\
LCJwcm9maWxlIjoiYWRtaW4iLCJncm91cHMiOlsxXSwidXNlcm\
lkIjoxLCJqdGkiOiIzNDkzN2E3OGJkNWIxNjdmMTg3ZTMyODZj\
NGE1N2YzOCIsInNlcnZpY2UiOiJhZG1pbiIsInVzZXJuYW1lIjoiYWRtaW4ifQ.\
U6IYw8Zpj2JOJ1g5mg-1wo2rzepfIwEqoCWs1BONngg";

// Mock functions
const mockConfig = {
  express: {
    next: jest.fn(),
    request: {
      header: jest.fn(),
    },
    response: jest.fn(() => ({
      get: jest.fn(),
      json: jest.fn(),
      send: jest.fn(),
      status: jest.fn(),
    })),
  },
};

/**
 * Mocks
 */
jest.doMock("express", () => ({
  express: mockConfig.express,
}));

/**
 * authMiddleware functions tests
 */
describe("authMiddleware", () => {
  let req: IAuthRequest;
  let res: express.Response;
  let spyHeader: jest.SpyInstance;
  let spyStatus: jest.SpyInstance;
  let spySend: jest.SpyInstance;

  beforeEach(() => {
    res = express.response;
    req = express.request;
    // To isolate tests from one another, we need to remove these parameters,
    // since they can be persisted between tests
    if (req.hasOwnProperty("user")) {
      delete req.user;
    }
    if (req.hasOwnProperty("service")) {
      delete req.service;
    }

    jest.resetAllMocks();
  });

  beforeAll(() => {
    spyHeader = jest.spyOn(express.request, "header");
    spyStatus = jest.spyOn(express.response, "status");
    spySend = jest.spyOn(express.response, "send");
  });

  /**
   * Function authParse tests
   */
  describe("authParse", () => {
    /**
     * Success tests
     */
    it("should parse", () => {
      spyHeader.mockReturnValueOnce(jwt);

      authParse(req, res, mockConfig.express.next);

      expect(req.user).toEqual("admin");
      expect(req.service).toEqual("admin");

      expect(spyHeader).toHaveBeenCalled();
      expect(mockConfig.express.next).toHaveBeenCalled();
    });

    /**
     * Failure tests
     */
    it("should not parse - token undefined", () => {
      mockConfig.express.request.header.mockReturnValueOnce(undefined);
      authParse(req, res, mockConfig.express.next);

      expect(req.user).toBeUndefined();
      expect(req.service).toBeUndefined();

      expect(mockConfig.express.next).toHaveBeenCalled();
    });

    it("should not parse - token malformed", () => {
      spyHeader.mockReturnValueOnce("testMalformedToken");

      authParse(req, res, mockConfig.express.next);

      expect(spyStatus).toHaveBeenCalledWith(401);
      expect(spySend).toHaveBeenCalledWith(expect.any(InvalidTokenError));
      expect(mockConfig.express.next).not.toHaveBeenCalled();

      expect(req.user).toBeUndefined();
      expect(req.service).toBeUndefined();
    });
  });

  /**
   * Function authEnforce tests
   */
  describe("authEnforce", () => {
    /**
     * Success tests
     */
    it("should authorize", () => {
      spyHeader.mockReturnValueOnce(jwt);

      authParse(req, res, mockConfig.express.next);
      authEnforce(req, res, mockConfig.express.next);

      expect(mockConfig.express.next).toHaveBeenCalled();
    });

    /**
     * Failure tests
     */
    it("should not authorize - no user", () => {
      authEnforce(req, res, mockConfig.express.next);

      expect(spyStatus).toHaveBeenCalledWith(401);
      expect(spySend).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it("should not authorize - no service", () => {
      req.user = "admin";

      authEnforce(req, res, mockConfig.express.next);

      expect(spyStatus).toHaveBeenCalledWith(401);
      expect(spySend).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });
});
