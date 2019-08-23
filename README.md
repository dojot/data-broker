# dojot data-broker

This repository contains the implementation for the event broker used internally by
dojot's event processing services. This component should replace functionality previously
provided by FIWARE orion context broker.

## How to build

Being written in TypeScript, one can use npm's configured scripts to build this:

```shell
# installs all dependencies
npm install
# builds
npm run-script build
```

To generate a docker container, one may issue the following command:

```shell
docker build -t <tag> -f docker/Dockerfile .
```

Then an image tagged as `<tag>` will be made available. Do notice that a pre-built "official" version for this component may be found at dojot's [dockerhub](https://hub.docker.com/r/dojot/data-broker/).

## How to run

Once built:

```shell
npm run subscription
```

Do notice that this component depends on a couple of external infrastructure to work. For an easier
setup with an fully operational broker, please consider the use of the minimal docker-compose
service definitions available at `local/compose.yml`, which configures instances of all required
infrastructure for the broker.

To spin up an environment using that:

```shell
docker-compose -f local/compose.yml -p broker up
```

This will setup an environment using the latest "official" image from the service, retrieved from
dockerhub. To use your own generated image either update the `image` stanza of the `broker` service
on `local/compose.yml` to the tag of your own build, or comment out the `broker` service from the
file, and create a container within the same network of the docker-compose environment:

```shell
docker run -it --rm -v $PWD:/opt/subscription-manager --network broker_default <tag> bash
```

That, along with the volume mounting (included in the example above) provides a very easy way of
building a development environment for the service.

## How to use

This service implements two information dissemination features required by most of the services
that compose dojot: the management of topics for information dissemination (e.g. device creation
events) and brokering of device data between interested parties (subscribers), based on flexible
subscription patterns.

For the first (meta-information dissemination), this service handles the creation of runtime kafka
topics that segregate information on a tenant context basis, restricting the set of events a given
service is exposed to only the ones it is actually allowed to process.

The second use-case deals with the routing of device events to all interested parties - be them
internal to dojot (e.g. history, flow processor) or external (e.g. an application).

As with the context broker in FIWARE, when a process is interested in receiving a set of particular
events, it should issue a subscription request to data-broker, detailing the conditions that must
be satisfied for an event to be sent to the requester. The set of specified conditions may take into
account information about its original emitter (i.e. the device itself), some conditions on the
values of individual attributes that are contained in the event or a combination of both.

When a subscription request is accepted by data-broker, a kafka topic identifier is returned to the
caller, so that it can follow up on the events that meed the set of conditions imposed by the
subscription request.

As with meta-information dissemination topics, all events sent to any given topic are restricted
to the tenancy context from which the subscription request was originated. That said, should two
users, from the same tenancy context, issue two different subscription requests with the exact same
conditions specified, data-broker might return the same kafka topic to satisfy both subscriptions.

On both cases, as we are dealing with kafka queues, it is up to the consumers of the returned topics
to keep track of where the head of its processed queue is at. That allows consumers to process events
at their own pace, thus avoiding unwanted data loss in the process. Another important characteristic
of the configured topics is that, at the moment, they are single-partitioned.

## Removal Notes

The Subscription service is being removed from Data Broker because of its lack of use. As a consequence,
the endpoint `/subscription` is being removed.

With the removal of subscription-engine.ts, other files needed to be excluded from the repository:

- Condition.ts
- consumer.ts
- Event.ts
- Notification.ts
- simple-tools.ts
- Subscription.ts

All their tests were removed too.
