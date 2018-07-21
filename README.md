# dojot data-broker

This repository contains the implementation for the event broker used
internally by dojot's event processing services. This component should replace
functionality previously provided by FIWARE orion context broker.

## Installation

Being written in TypeScript, one can use npm's configured scripts to build
this:

```shell
# installs all dependencies
npm install
# builds
npm run-script build
```

To generate a docker container, one may issue the following command:

```shell
# you may need sudo on your machine:
# https://docs.docker.com/engine/installation/linux/linux-postinstall/
docker build -t <tag> -f docker/Dockerfile .
```

Then an image tagged as `<tag>` will be made available. Do notice that a
pre-built "official" version for this component may be found at dojot's
[dockerhub](https://hub.docker.com/r/dojot/data-broker/).

## Configuration

In order to properly start data-broker, the following variables can be set. All
values are the default ones.

```shell
#
# Data-broker cache configuration
#

# Type of cache used. Currently only Redis is suported.
# If set to 'NOCACHE' auth will work without cache.
# Disabling cache usage considerably degrades performance.
export DATABROKER_CACHE_NAME="redis"
# username to access the cache database
export DATABROKER_CACHE_USER="redis"
# password to acces the cache database
export DATABROKER_CACHE_PWD=""
# ip or hostname where the cache can be found
export DATABROKER_CACHE_ADDRESS="data-broker-redis"
# Redis port
export DATABROKER_CACHE_PORT=6379
# cach database name (or number)
export DATABROKER_CACHE_DATABASE="0"

#
# Data-broker main config.
#

# Port used by data-broker to receive request
export DATABROKER_PORT="80"

#
# Other services
#
# Kafka address
export KAFKA_ADDRESS="kafka"
# Kafka port
export KAFKA_PORT=9092
# Zookeeper address
export ZOOKEEPER_ADDRESS="zookeeper"
# Zookeeper port
export ZOOKEEPER_PORT=2181

#
# dojot variables
#

# Subject used to publish/consume data generated from devices
export DOJOT_SUBJECT_DEVICE_DATA="device-data"

```

## How to run

Data-broker depends on a couple of external infrastructure to
work properly, which are Kafka, Zookeeper and Redis. These can be instantiated by the
following commands

```shell
docker network create data-broker-net
docker run --rm -d  --network data-broker-net -p2181:2181 --name zookeeper zookeeper:3.4
docker run --rm -e ZOOKEEPER_IP=zookeeper -e KAFKA_NUM_PARTITIONS=10  --network data-broker-net -p9092:9092 --name kafka -d ches/kafka:0.10.1.1
redis-server &
```

If you don't want to user Docker, you could obviously run locally both Kafka
and Zookeeper.

This will start an instance of Zookeeper and Kafka (within a "data-broker-net"
network so that Kafka can talk to Zookeeper) and a Redis instance (listening to
its default port).

To start data-broker, execute the following command:

```shell
npm run-script subscription
```

## How to use

This service implements two information dissemination features required by most
of the services that compose dojot: the management of topics for information
dissemination (e.g. device creation events) and brokering of device data
between interested parties (subscribers), based on flexible subscription
patterns.

For the first (meta-information dissemination), this service handles the
creation of runtime kafka topics that segregate information on a tenant context
basis, restricting the set of events a given service is exposed to only the
ones it is actually allowed to process.

The second use-case deals with the routing of device events to all interested
parties - be them internal to dojot (e.g. history, flow processor) or external
(e.g. an application).

As with the context broker in FIWARE, when a process is interested in receiving
a set of particular events, it should issue a subscription request to
data-broker, detailing the conditions that must be satisfied for an event to be
sent to the requester. The set of specified conditions may take into account
information about its original emitter (i.e. the device itself), some
conditions on the values of individual attributes that are contained in the
event or a combination of both.

When a subscription request is accepted by data-broker, a kafka topic
identifier is returned to the caller, so that it can follow up on the events
that meed the set of conditions imposed by the subscription request.

As with meta-information dissemination topics, all events sent to any given
topic are restricted to the tenancy context from which the subscription request
was originated. That said, should two users, from the same tenancy context,
issue two different subscription requests with the exact same conditions
specified, data-broker might return the same kafka topic to satisfy both
subscriptions.

On both cases, as we are dealing with kafka queues, it is up to the consumers
of the returned topics to keep track of where the head of its processed queue
is at. That allows consumers to process events at their own pace, thus avoiding
unwanted data loss in the process. Another important characteristic of the
configured topics is that, at the moment, they are single-partitioned.
