var fs = require('fs');
var config = JSON.parse(fs.readFileSync('./snow.conf.json'));

var data = {
};

if (config.snow && config.snow.username && config.snow.password){
  config.snow.auth = "Basic " + new Buffer(config.snow.username + ":" + config.snow.password).toString('base64');
  delete config.snow.username;
  delete config.snow.password;
  fs.writeFileSync("./snow.conf.json",JSON.stringify(config,null,2));
}

if (config.snow 
  && config.snow.instance 
  && config.snow.auth
  && config.snow.instance !== '' 
  && config.snow.auth !== ''){

  // build the proxy file...
  data = {
    "/api": {
      "target": "https://" + config.snow.instance,
      "logLevel": "info",
      "secure": false,
      "headers": {
        "Host": config.snow.instance,
        "authorization": config.snow.auth
      }
    }
  };

}


fs.writeFileSync("./proxy.conf.json",JSON.stringify(data,null,2));
