import * as logger from "winston";

// winston-3.0.0 will have a nice "format" attribute.
logger.configure({
  level: "debug",
  transports: [
    new logger.transports.Console(),
  ],
});

export { logger };
