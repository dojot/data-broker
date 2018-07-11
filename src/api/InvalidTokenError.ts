/* jslint node: true */
"use strict";

class InvalidTokenError {
  public message: string;
  constructor() {
    this.message = "Invalid authentication token given";
  }
}

export { InvalidTokenError };
