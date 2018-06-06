FROM node:8-alpine as basis

# Installing build dependencies
RUN apk --no-cache add gcc g++ musl-dev make python

RUN mkdir -p /opt/data-broker
WORKDIR /opt/data-broker
COPY . .
RUN npm install && npm run-script build && npm prune --production

FROM node:8-alpine
WORKDIR /opt/data-broker
COPY --from=basis /opt/data-broker /opt/data-broker
CMD ["npm", "run", "subscription"]

