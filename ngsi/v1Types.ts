/* jslint node: true */
"use strict";

export interface Status {
  code: string;
  reasonPhrase: string;
}

export interface Attribute {
  name: string;
  type: string;
  value: string;
}

export interface ContextElement {
  attributes: Attribute[];
  type: string;
  isPattern: string;
  id: string;
}

export interface ContextResponse {
  contextElement: ContextElement[];
  statusCode: Status;
}

export interface Event {
  subscriptionId: string;
  originator: string;
  contextResponses: ContextResponse[];
}
