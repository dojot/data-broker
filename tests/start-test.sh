#!/bin/sh

node tests/build/tests/dojot-mock.js &

export DATA_BROKER_URL=http://localhost:80
export KEYCLOAK_URL=http://localhost:5002

dredd