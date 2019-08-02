/* jslint node: true */
"use strict";

import {Messenger} from "@dojot/dojot-module";
import {logger} from "@dojot/dojot-module-logger";
import sio = require("socket.io");
import uuid = require("uuid/v4");
import {FilterManager} from "./FilterManager";
import {RedisManager} from "./redisManager";
import {TopicManagerBuilder} from "./TopicBuilder";

const TAG = {filename: "socket-io"};

function getKey(token: string): string {
    return "si:" + token;
}

/**
 * Class used to handle SocketIO operations
 */
class SocketIOHandler {
    private ioServer: SocketIO.Server;
    private messenger: Messenger;
    private fManager: FilterManager;

    /**
     * Constructor.
     * @param httpServer HTTP server as a basis to offer SocketIO connection
     */
    constructor(httpServer: any, messenger: Messenger) {
        logger.debug("Creating new SocketIO handler...", TAG);

        logger.debug("Creating sio server...", TAG);
        this.ioServer = sio(httpServer);
        logger.debug("... sio server was created.", TAG);

        this.ioServer.use(this.checkSocket);

        logger.debug("Registering SocketIO server callbacks...", TAG);

        this.messenger = messenger;
        this.messenger.on("device-data", "message", this.handleMessage.bind(this));
        this.messenger.on("dojot.device-manager.device", "message", this.handleMessageActuator.bind(this));

        this.fManager = new FilterManager();

        this.ioServer.on("connection", (socket: sio.Socket) => {
            logger.debug("Got new SocketIO connection", TAG);
            const redis = RedisManager.getClient();
            redis.runScript(
                __dirname + "/lua/setDel.lua",
                [getKey(socket.handshake.query.token)],
                [],
                (error: any, tenant: string) => {
                    if (error || !tenant) {
                        logger.error(
                            `Failed to find suitable context for socket: ${socket.id}.`, TAG);
                        logger.error("Disconnecting socket.", TAG);
                        socket.disconnect();
                    } else {
                        logger.debug("Creating new socket...", TAG);
                        this.processNewSocketIo(socket, tenant);
                        logger.debug("... new socket created.", TAG);
                    }
                },
            );
        });
        logger.debug("... SocketIO server callbacks were registered.", TAG);
        logger.debug("... SocketIO handler was created.", TAG);
    }

    public processNewSocketIo(socket: sio.Socket, tenant: string) {
        const givenSubject = socket.handshake.query.subject;
        const givenToken = socket.handshake.query.token;
        logger.debug(`Received subject is ${givenSubject}.`, TAG);
        logger.debug(`Received token is ${givenToken}.`, TAG);

        logger.debug(`Will assign client [${givenToken}] to namespace: (${tenant}): ${socket.id}`, TAG);
        if (givenSubject !== "dojot.notifications") {
            socket.join(tenant);
        } else {
            this.registerSocketIoNotification(socket, tenant);
        }
    }

    public registerSocketIoNotification(socket: sio.Socket, tenant: string) {
        logger.debug("Received connection for dojot.notifications", TAG);
        this.messenger.on("dojot.notifications", "message", (ten: string, msg: any) => {
            logger.debug("Received dojot notification.", TAG);
            if (ten === tenant) {
                if (this.fManager.checkFilter(msg, socket.id)) {
                    socket.emit("notification", msg);
                }
            }
        }, socket.id);

        logger.debug("Will register new filter callback", {filename: "SocketIOHandler "});
        socket.on("filter", (filter) => {
            logger.debug("Received new filter", {filename: "SocketIOHandler "});
            this.fManager.update(JSON.parse(filter), socket.id);
        });
        socket.on("disconnect", () => {
            logger.debug("Socket disconnected. Will unregister callback", {filename: "SocketIOHandler "});
            this.messenger.unregisterCallback("dojot.notifications", "message", socket.id);
        });
    }

    /**
     * Generate a new token to be used in SocketIO connection.
     * @param tenant The tenant related to this new token
     */
    public getToken(tenant: string): string {
        logger.debug(`Generating new token for tenant ${tenant}...`, TAG);

        logger.debug("Creating new topic/retrieving current for tenant", TAG);
        const topicManager = TopicManagerBuilder.get(tenant);
        topicManager.getCreateTopic(
            "device-data",
            (error?: any, topic?: string) => {
                if (error || !topic) {
                    logger.error(
                        `Failed to find appropriate topic for tenant: ${
                            error ? error : "Unknown topic"
                            }`, TAG);
                    return;
                }
            });
        logger.debug("... Kafka topic creation/retrieval was requested.", TAG);

        logger.debug("Associating tenant and SocketIO token...", TAG);
        const token = uuid();
        const redis = RedisManager.getClient();
        redis.client.setex(getKey(token), 60, tenant);
        logger.debug("... token and tenant were associated.", TAG);

        logger.debug(`... token for tenant ${tenant} was created: ${token}.`, TAG);
        return token;
    }

    /**
     * Callback function used to process messages received from Kafka library.
     * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
     * @param error Error received from Kafka library.
     * @param message The message received from Kafka Library
     */
    private handleMessage(nsp: string, message: string) {
        logger.debug("Processing message just received...", TAG);

        let data: any;
        logger.debug("Trying to parse received message payload...", TAG);
        try {
            data = JSON.parse(message);
        } catch (err) {
            if (err instanceof TypeError) {
                logger.debug("... message payload was not successfully parsed.", TAG);
                logger.error(`Received data is not a valid event: ${message}`, TAG);
            } else if (err instanceof SyntaxError) {
                logger.debug("... message payload was not successfully parsed.", TAG);
                logger.error(`Failed to parse event as JSON: ${message}`, TAG);
            }
            return;
        }
        logger.debug("... message payload was successfully parsed.", TAG);

        if (data.hasOwnProperty("metadata")) {
            if (!data.metadata.hasOwnProperty("deviceid")) {
                logger.debug("... received message was not successfully processed.", TAG);
                logger.error("Received data is not a valid dojot event - has no deviceid", TAG);
                return;
            }
        } else {
            logger.debug("... received message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no metadata", TAG);
            return;
        }

        logger.debug(`Will publish event to namespace ${nsp} from device ${data.metadata.deviceid}`,
            {filename: "SocketIOHandler"});
        this.ioServer.to(nsp).emit(data.metadata.deviceid, data);
        this.ioServer.to(nsp).emit("all", data);
        logger.debug("... received message was successfully processed.", TAG);
    }

    /**
     * Callback function used to process actuator message  received from Kafka library.
     * @param nsp SocketIO namespace to send out messages to all subscribers. These are tenants.
     * @param error Error received from Kafka library.
     * @param message The actuator message  received from Kafka Library
     */
    private handleMessageActuator(nsp: string, message: string) {
        logger.debug("Processing actuator message just received...", TAG);
        let data: any;
        logger.debug("Trying to parse received actuator message payload...", TAG);
        try {
            data = JSON.parse(message);
        } catch (err) {
            if (err instanceof TypeError) {
                logger.debug("... actuator message payload was not successfully parsed.", TAG);
                logger.error(`Received data is not a valid event: ${message}`, TAG);
            } else if (err instanceof SyntaxError) {
                logger.debug("... actuator message payload was not successfully parsed.", TAG);
                logger.error(`Failed to parse event as JSON: ${message}`, TAG);
            }
            return;
        }
        logger.debug("... actuator message payload was successfully parsed.", TAG);

        if (!data.hasOwnProperty("event")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no event", TAG);
            return;
        } else if (data.event !== "configure") {
            logger.debug("... received message is not an actuation one, discarding it.", TAG);
            return;
        }

        if (!data.hasOwnProperty("meta")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no meta", TAG);
            return;
        } else if (!data.meta.hasOwnProperty("service")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no meta.service", TAG);
            return;
        } else if (!data.meta.hasOwnProperty("timestamp")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no meta.timestamp", TAG);
            return;
        }

        if (!data.hasOwnProperty("data")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no data", TAG);
            return;
        } else if (!data.data.hasOwnProperty("id")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no data.id", TAG);
            return;
        } else if (!data.data.hasOwnProperty("attrs")) {
            logger.debug("... received actuator message was not successfully processed.", TAG);
            logger.error("Received data is not a valid dojot event - has no data.attrs", TAG);
            return;
        }
        const {data: {id: deviceid}, meta: {service: tenant, timestamp}} = data;
        const normalizeData = {
            attrs: data.data.attrs,
            metadata: {
                deviceid,
                tenant,
                timestamp,
            },
        };

        logger.debug(`Will publish event to namespace ${nsp} from device ${deviceid}`,
            {filename: "SocketIOHandler"});
        this.ioServer.to(nsp).emit(deviceid, normalizeData);
        this.ioServer.to(nsp).emit("all", normalizeData);
        logger.debug("... received actuator message was successfully processed.", TAG);
    }

    /**
     *
     * @param socket The socket to be checked
     * @param next Next verification callback. Used by SocketIO library.
     */
    private checkSocket(socket: SocketIO.Socket, next: (error?: Error) => void) {
        const givenToken = socket.handshake.query.token;
        if (givenToken) {
            const redis = RedisManager.getClient();
            redis.client.select(0);
            redis.client.get(getKey(givenToken), (error, value) => {
                if (error) {
                    return next(new Error("Failed to verify token"));
                }
                if (value) {
                    return next();
                } else {
                    return next(new Error("Authentication error: unknown token"));
                }
            });
        } else {
            return next(new Error("Authentication error: missing token"));
        }
    }
}

export {SocketIOHandler};
