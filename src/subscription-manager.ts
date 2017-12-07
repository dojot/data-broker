/* jslint node: true */
"use strict";

import engine = require('./subscription-engine');
import bodyParser = require('body-parser');
import express = require('express');
import util = require('util');
import {AuthRequest, authEnforce, authParse} from './api/authMiddleware';

const app = express();
app.use(authParse);
app.use(authEnforce);
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

/*
 * Subscription management endpoints
 */
app.post('/subscription', function (request: AuthRequest, response: express.Response) {
  console.log('Body: ' + util.inspect(request.body, {depth: null}));
  let subscription = request.body;
  if ('id' in subscription.subject.entities) {
    engine.addSubscription('id', subscription.subject.entities.id, subscription);
  } else if ('model' in subscription.subject.entities) {
    engine.addSubscription('model', subscription.subject.entities.model, subscription);
  } else if ('type' in subscription.subject.entities) {
    engine.addSubscription('type', subscription.subject.entities.type, subscription);
  }
  response.send('Ok!');
});

app.listen(3500, function() {
  console.log('Subscription manager listening on port 3500');
  engine.init();
});
