/* jslint node: true */
"use strict";

class UnauthorizedError {
  public message: string;
  constructor() {
    this.message = "Authentication (JWT) required for API";
  }
}

export { UnauthorizedError};
