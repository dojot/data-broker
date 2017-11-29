/* jslint node: true */
"use strict";

import express = require('express');

function b64decode(data: string): string {
  if (typeof Buffer.from === "function") {
    return Buffer.from(data, 'base64').toString();
  } else {
    return (new Buffer(data, 'base64')).toString();
  }
}

export interface AuthRequest extends express.Request {
  user: string;
  userid: string;
  service: string;
}

class UnauthorizedError {
  message: string;
  constructor(){
    this.message = "Authentication (JWT) required for API";
  }
}

class InvalidTokenError {
  message: string = "Invalid authentication token given";
  constructor(){}
}

export function authParse(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (req.header('authorization') === undefined) {
    return next();
  }

  const token = req.header('authorization')!.split('.');
  if (token.length != 3) {
    return res.status(401).send(new InvalidTokenError());
  }

  const tokenData = JSON.parse(b64decode(token[1]));

  req.user = tokenData.username;
  req.userid = tokenData.userid;
  req.service = tokenData.service;
  next();
}

export function authEnforce(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (req.user === undefined || req.user!.trim() === "" ) {
    // valid token must be supplied
    return res.status(401).send(new UnauthorizedError());
  }

  if (req.service === undefined || req.service!.trim() === "" ) {
    // valid token must be supplied
    return res.status(401).send(new UnauthorizedError());
  }

  next();
}
