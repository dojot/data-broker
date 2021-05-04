/* jslint node: true */
"use strict";

import { logger } from "@dojot/dojot-module-logger";
import express = require("express");
import { InvalidTokenError } from "./InvalidTokenError";
import { UnauthorizedError } from "./UnauthorizedError";

const TAG = { filename: "Auth" };

/**
 * Open up a base64 encoded string.
 * @param data The data to be decoded.
 */
function b64decode(data: string): string {
  return Buffer.from(data, "base64").toString();
}

/**
 * Interface for handling authorization requests.
 * All parameters should be optional, as pointed out here:
 * https://stackoverflow.com/questions/49303375/property-push-is-missing-in-type-request-ntlmrequest-response-response
 */
interface IAuthRequest extends express.Request {
  user?: string;
  userid?: string;
  service?: string;
}

function authParse(req: IAuthRequest, res: express.Response, next: express.NextFunction) {
  const rawToken = req.header("authorization");
  if (rawToken === undefined) {
    next();
    return;
  }

  const token = rawToken!.split(".");
  if (token.length !== 3) {
    logger.error("Got invalid request: token is malformed.", TAG);
    logger.error(`Token is: ${rawToken}`, TAG);
    res.status(401);
    res.send(new InvalidTokenError());
    return;
  }

  const tokenData = JSON.parse(b64decode(token[1]));

  req.user = tokenData.username;
  req.userid = tokenData.userid;

  // to ensure backward compatibility
  if (tokenData.service) {
    req.service = tokenData.service;
  } else if (tokenData.iss) {
    req.service = tokenData.iss.substring(tokenData.iss.lastIndexOf('/') + 1);
  }
  next();
}

function authEnforce(req: IAuthRequest, res: express.Response, next: express.NextFunction) {
  if (req.user === undefined || req.user!.trim() === "") {
    // valid token must be supplied
    logger.error("Got invalid request: user is not defined in token.", TAG);
    logger.error(`Token is: ${req.header("authorization")}`, TAG);
    res.status(401);
    res.send(new UnauthorizedError());
  } else if (req.service === undefined || req.service!.trim() === "") {
    // valid token must be supplied
    logger.error("Got invalid request: service is not defined in token.", TAG);
    logger.error(`Token is: ${req.header("authorization")}`, TAG);
    res.status(401);
    res.send(new UnauthorizedError());
  } else {
    next();
  }
}

export { IAuthRequest, authParse, authEnforce };
