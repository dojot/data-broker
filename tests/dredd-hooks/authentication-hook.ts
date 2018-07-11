import hooks = require("hooks");

function generate_token() {
  return ("Bearer " + new Buffer("dummy jwt schema").toString("base64")) + "."
         + (new Buffer(JSON.stringify({service: "admin", username: "admin"})).toString("base64")) + "."
         + (new Buffer("dummy signature").toString("base64"));

}

hooks.beforeEach((transaction: any, done: any) => {
  // Generate token
  const auth = generate_token();
  if ("request" in transaction) {
      if (("headers" in transaction.request) &&
          ("Authorization" in transaction.request.headers)) {
        transaction.request.headers.Authorization = auth;
      }
  }
  done();
});
