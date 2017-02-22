var fs = require('fs');
var http = require('https');

// get the configuration file...
var config = JSON.parse(fs.readFileSync('./snow.conf.json'));
console.log('\n\n');

if (config.snow && config.snow.username && config.snow.password){
  config.snow.auth = "Basic " + new Buffer(config.snow.username + ":" + config.snow.password).toString('base64');
  delete config.snow.username;
  delete config.snow.password;
}


// if there is a name and scope but no sys_id...then let's find or make it...
if (config.application && config.application.name !== '' && config.application.scope !== '' && !config.application.sys_id){


  get_property("glide.appcreator.company.code",function(code){
    if (config.application.scope.indexOf('x_') !== 0)
      config.application.scope = "x_" + code + "_" + config.application.scope.toLowerCase().replace(/[^0-9a-z_]+/g,'').replace(/\s+/,'_');

    console.log("Checking for scope: " + config.application.scope);

    var options = {
      host: config.snow.instance,
      path: '/api/now/v1/table/sys_scope?sysparm_query=scope=' + config.application.scope,
      headers: {
        accept: 'application/json',
        authorization: config.snow.auth
      }
    };

    var req = http.request(options,function(res){
      var statusCode = res.statusCode;
      if (statusCode == 200){
        console.log("The scope name is already taken. Exiting.");
        return;
      }
      if (statusCode !== 404){
        console.log("Something went wrong trying to check for the scope. HTTP Code: " + statusCode);
        return;
      }

      console.log("Scope doesn't exist...creating it now.");
      var options = {
        host: config.snow.instance,
        path: '/api/now/v1/table/sys_scope',
        method: 'POST',
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: config.snow.auth
        }
      };
      var body = {
        licensable: "true",
        runtime_access_tracking: "permissive",
        trackable: "true",
        active: "true",
        js_level: "helsinki_es5",
        version: "0.0.1",
        name: config.application.name,
        scope: config.application.scope,
        source: config.application.scope,
        sys_class_name: "sys_app"
      };

      var req = http.request(options,function(res){
        var statusCode = res.statusCode;
        if (statusCode !== 201){
          console.log("Something went wrong trying to create the scope. HTTP Code: " + statusCode);
          return;
        }

        var rawData = '';
        res.on('data', (chunk) => rawData += chunk );
        res.on('end', () => { 

          console.log("Application successfully created");
          var record = JSON.parse(rawData);
          config.application.sys_id = record.result.sys_id;
          console.log("Creating files");
          create_files();
        });
      });
      req.write(JSON.stringify(body));
      req.end();

    });
    req.end();

  },function(err){
    console.log("There was an error getting your company code (glide.appcreator.company.code) from the instance:",err);
  })
 



} else {
  console.log("Either you have a sys_id already...or you have files...or you don't have an application name and scope. Either way...I'm exiting. Good day sir!\n");
}





function create_files(){
  if (!config.files) config.files = {html: {}, js: {}, css: {}};
  var files = [{
    table: "sys_ui_page",
    body: {
      direct: "true",
      description: "Index page of the angular2 SAP.",
      sys_class_name: "sys_ui_page",
      sys_package: config.application.sys_id,
      name: 'index',
      sys_name: 'index',
      html: "",
      sys_scope: config.application.sys_id,
      category: "general"
    }
  },{
    table: "sys_ui_script",
    body: {
      active: "true",
      use_scoped_format: "true",
      global: "false",
      script_name: "main",
      script: "",
      sys_class_name: "sys_ui_script",
      sys_package: config.application.sys_id,
      name: config.application.scope + ".main",
      sys_name: config.application.scope + ".main",
      sys_scope: config.application.sys_id
    }
  },{
    table: "sys_ui_script",
    body: {
      active: "true",
      use_scoped_format: "true",
      global: "false",
      script_name: "inline",
      script: "",
      sys_class_name: "sys_ui_script",
      sys_package: config.application.sys_id,
      name: config.application.scope + ".inline",
      sys_name: config.application.scope + ".inline",
      sys_scope: config.application.sys_id
    }
  },{
    table: "sys_ui_script",
    body: {
      active: "true",
      use_scoped_format: "true",
      global: "false",
      script_name: "vendor",
      script: "",
      sys_class_name: "sys_ui_script",
      sys_package: config.application.sys_id,
      name: config.application.scope + ".vendor",
      sys_name: config.application.scope + ".vendor",
      sys_scope: config.application.sys_id
    }
  },{
    table: "sys_ui_script",
    body: {
      active: "true",
      use_scoped_format: "true",
      global: "false",
      script_name: "polyfills",
      script: "",
      sys_class_name: "sys_ui_script",
      sys_package: config.application.sys_id,
      name: config.application.scope + ".polyfills",
      sys_name: config.application.scope + ".polyfills",
      sys_scope: config.application.sys_id
    }
  },{
    table: "content_css",
    body: {
      type: "local",
      sys_class_name: "content_css",
      sys_package: config.application.sys_id,
      name: "styles",
      sys_name: "styles",
      style: "",
      sys_scope: config.application.sys_id,
    }
  }];

  responses = 0;
  for (var i=0; i < files.length; i++){
    (function(file){
      console.log("Creating file: " + file.body.name + " of type " + file.body.sys_class_name);

      var options = {
        host: config.snow.instance,
        path: '/api/now/v1/table/' + file.table,
        method: 'POST',
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: config.snow.auth
        }
      };

      var req = http.request(options,function(res){
        var statusCode = res.statusCode;
        if (statusCode !== 201){
          console.log("Something went wrong trying to create file " + file.body.name + ". HTTP Code: " + statusCode);
          return;
        }

        var rawData = '';
        res.on('data', (chunk) => rawData += chunk );
        res.on('end', () => { 

          console.log("Success creating file: " + file.body.name + " of type " + file.body.sys_class_name);
          var record = JSON.parse(rawData).result;

          if (file.body.name == 'index')                                  config.files.html['index'] = record.sys_id;
          if (file.body.name == 'index')                                  config.snow.endpoint = record.endpoint;
          if (file.body.name == config.application.scope + '.inline')    config.files.js['inline'] = record.sys_id;
          if (file.body.name == config.application.scope + '.main')      config.files.js['main'] = record.sys_id;
          if (file.body.name == config.application.scope + '.vendor')    config.files.js['vendor'] = record.sys_id;
          if (file.body.name == config.application.scope + '.polyfills') config.files.js['polyfills'] = record.sys_id;
          if (file.body.name == 'styles')                                 config.files.css['styles'] = record.sys_id;

          responses++;

          if (responses == files.length) 
            fs.writeFile('./snow.conf.json',JSON.stringify(config,null,2),function(err){ 
                if (err) throw err; 

                console.log("Your application has been setup and is available at: https://" + config.snow.instance + "/" + config.snow.endpoint); 
            });

        });
      });
      req.write(JSON.stringify(file.body));
      req.end();

    })(files[i]);
  }

}
















function get_property(name,success,error){

  console.log("Getting property: " + name);
  var options = {
    host: config.snow.instance,
    path: '/api/now/v1/table/sys_properties?sysparm_query=name=' + name + '&sysparm_limit=1',
    headers: {
      accept: 'application/json',
      authorization: config.snow.auth
    }
  };

  var req = http.request(options, function(res) {
    const statusCode = res.statusCode; 
    if (statusCode !== 200) {
      console.log(res.headers);
      error("Response Code: " + statusCode,"Property " + name + " was not found on the instance.");
      return;
    }

    let rawData = '';
    res.on('data', (chunk) => rawData += chunk );
    res.on('end', () => {
      try {
        let parsedData = JSON.parse(rawData);
        success(parsedData.result[0].value);
      } catch (e) {
        error(e.message);
      }
    });
  });
  req.end();

}