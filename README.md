# **Data Broker**

[![License badge](https://img.shields.io/badge/license-GPL-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Docker badge](https://img.shields.io/docker/pulls/dojot/data-broker.svg)](https://hub.docker.com/r/dojot/data-broker/)
[![Build Status](https://travis-ci.org/dojot/data-broker.svg?branch=development)](https://travis-ci.org/dojot/data-broker)
[![codecov](https://codecov.io/gh/dojot/data-broker/branch/development/graph/badge.svg)](https://codecov.io/gh/dojot/data-broker)

This repository contains the implementation for the event broker used internally by dojot's event
processing services.

# What it does

Data Broker provides two services: Kafka's topic management and real-time data. These are required
by most of the services that compose dojot, being essential to maintain the system working.

The topic management service handles Kafka's topics, used for information dissemination (e.g.
device creation events), handling the creation of runtime Kafka topics that segregate information
on a tenant context basis, restricting the set of events a given service is exposed to only the
ones it is actually allowed to process.

The real-time service deals with the routing of data received via sockets that is directed to
one or more devices. This data is shown in the device information screen in the GUI.

As we are dealing with Kafka queues, it is up to the consumers of the returned topics to keep track
of where the head of its processed queue is at. That allows consumers to process events at their
own pace, thus avoiding unwanted data loss in the process. Another important characteristic of the
configured topics is that, by default, they are single-partitioned without replications. This can
be changed by using endpoints. Check Data Broker's
[API reference](https://dojot.github.io/data-broker/apiary_v0.3.0.html) for more information.

# dojot dependencies

Data Broker depends on some dojot modules to run. The minimum set of modules it needs to run is:

- Auth
- Kafka
- Redis

# Configuration

These are the environment variables used by Data Broker code.

Key                      | Purpose                                      | Default Value
------------------------ | -------------------------------------------- | -------------------
DATABROKER_CACHE_HOST    | Redis cache host address                     | "data-broker-redis"
DATABROKER_KAFKA_ADDRESS | Kafka address                                | "kafka"
DATABROKER_KAFKA_PORT    | Kafka port                                   | 9092
HC_CPU_USAGE_TIMEOUT     | Healthcheck CPU usage timeout (ms)           | 300000
HC_KAFKA_TIMEOUT         | Healthcheck Kafka timeout (ms)               | 30000
HC_MEMORY_USAGE_TIMEOUT  | Healthcheck Memory usage timeout (ms)        | 300000
HC_UPTIME_TIMEOUT        | Healthcheck Uptime timeout (ms)              | 300000
KAFKA_NUM_PARTITIONS     | Default number of partitions in Kafka topics | 1
KAFKA_REPLICATION_FACTOR | Default replication factor in Kafka topics   | 1
LOG_LEVEL                | Logger level (error, warn, info, debug)      | "info"
SERVICE_PORT             | Data Broker service port                     | 80

Some environment variables are used by dojot libraries that Data Broker uses.

Key                        | Purpose                                                     | Default Value
-------------------------- | ----------------------------------------------------------- | -----------------------------
AUTH_URL                   | Auth host address                                           | "http://auth:5000"
DATA_BROKER_URL            | Data Broker host address                                    | "http://data-broker"
DEVICE_MANAGER_URL         | Device Manager host address                                 | "http://device-manager:5000"
DOJOT_MANAGEMENT_TENANT    | Management tenant                                           | "dojot-management"
DOJOT_MANAGEMENT_USER      | Management user                                             | "dojot-management"
DOJOT_SUBJECT_DEVICES      | Subject for device management messages                      | "dojot.device-manager.device"
DOJOT_SUBJECT_DEVICE_DATA  | Subject for device data messages                            | "device-data"
DOJOT_SUBSCRIPTION_HOLDOFF | Time (ms) before attempting to subscribe to a set of topics | 2500
DOJOT_SUBJECT_TENANCY      | Subject for tenancy messages                                | "dojot.tenancy"
KAFKA_GROUP_ID             | Kafka group ID for consumers                                | "kafka"
KAFKA_HOSTS                | List of Kafka instances                                     | "kafka:9092"

# How to run

Beforehand, you need an already running dojot instance in your machine. See
[dojot documentation](https://dojotdocs.readthedocs.io/en/stable/) for more information on
installation methods.

Generate a Docker image:

```shell
docker build -t <username>/data-broker:<tag> -f docker/Dockerfile .
```

Then an image tagged as `<username>/data-broker:<tag>` will be made available. You can send it to
your DockerHub registry to made it available for non-local dojot installations:

```shell
docker push <username>/data-broker:<tag>
```

__NOTE THAT__ an official image is provided at dojot's
[DockerHub](https://hub.docker.com/r/dojot/data-broker/).

# Documentation

- [Development API docs](https://dojot.github.io/data-broker/apiary_development.html)
- [Latest API docs](https://dojot.github.io/data-broker/apiary_latest.html)

# Removal Notes

As of version `v0.5.0`, the subscription service is being removed from Data Broker because of its lack
of use. As a consequence, the endpoint `/subscription` has being removed.

# Issues and help

If you found a problem or need help, leave an issue in the main
[dojot repository](https://github.com/dojot/dojot) and we will help you!
