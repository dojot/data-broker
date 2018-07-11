/* jslint node: true */
"use strict";

export interface IStatus {
  code: string;
  reasonPhrase: string;
}

export interface IAttribute {
  name: string;
  type: string;
  value: string;
}

export interface IContextElement {
  attributes: IAttribute[];
  type: string;
  isPattern: string;
  id: string;
}

export interface IContextResponse {
  contextElement: IContextElement[];
  statusCode: IStatus;
}

export interface IEvent {
  subscriptionId: string;
  originator: string;
  contextResponses: IContextResponse[];
}
