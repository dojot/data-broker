FROM dojot/dredd-nodejs:8

WORKDIR /opt/subscription-manager
EXPOSE 80

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY . .
RUN npm run-script build
RUN npm run-script build-tests


CMD ["./tests/start-test.sh"]
