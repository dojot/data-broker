FROM node:8.14.0-alpine as basis

WORKDIR /opt/data-broker

RUN apk add git python make bash gcc g++ --no-cache

COPY package.json .
COPY package-lock.json .

RUN npm install
COPY . .
RUN npm run-script build


FROM node:8.14.0-alpine
COPY --from=basis  /opt/data-broker /opt/data-broker
WORKDIR /opt/data-broker
EXPOSE 80
CMD ["npm", "run", "subscription"]

