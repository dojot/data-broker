FROM node:8

COPY . /opt/subscription-manager/
WORKDIR /opt/subscription-manager

RUN npm install && npm run-script build

ENTRYPOINT npm run subscription
