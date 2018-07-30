var fs = require('fs');
var http = require('https');
var prompt = require('prompt');
var colors = require("colors/safe");


// get the configuration file...
var config = {};
try {
    config = JSON.parse(fs.readFileSync('./snow.conf.json'));
} catch (err) {
    console.log("No configuration file exists. Let's create one.");
}

console.log('\n\n');
prompt.start();


console.log('Copyright (c) 2017\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.');
prompt.get({
  properties: {
    confirm: {
      pattern: /^(yes|no|y|n)$/gi,
      description: colors.yellow('Do you want to continue? (y/N)'),
      required: false,
      default: ''
    }
  }
}, function (err, result){
  if (!result){
    console.log('\nExiting.');
    return;
  }
  
  if (!/^(yes|y)$/gi.test(result.confirm)){
    console.log('Exiting.');
    return;
  }

  start();
    
});


function start(){
  // check for instance info
  check_config(function(){

    if (config.snow && config.snow.username && config.snow.password){
      config.snow.auth = "Basic " + new Buffer(config.snow.username + ":" + config.snow.password).toString('base64');
      delete config.snow.username;
      delete config.snow.password;
    };
    console.log("Configuration check complete.");
    run()

  },function(err){
    console.log("\nAn error occured during configuration: " + err.message);
  });
}


function check_config(success,error,prompt_num){
  if (!prompt_num){
    console.log("Checking configuration parameters.");
    prompt_num = 0;
  }

  if (!config.snow) config.snow = {};
  if (!config.application) config.application = {};

  var prompts = [{
    attr: 'snow.instance',
    current: config.snow.instance,
    properties: {
      answer: {
        pattern: /^.+\.service-now\.com$/,
        description: colors.green('Enter your instance url (eg. dev.service-now.com)'),
        message: colors.red('Enter in the FQDN (eg. dev.service-now.com)'),
        required: true
      }
    }
  },{
    attr: 'snow.username',
    current: config.snow.auth,
    properties: {
      answer: {
        pattern: /^[a-zA-Z0-9-_\.]+$/,
        description: colors.green('Enter your username'),
        required: true
      }
    }
  },{
    attr: 'snow.password',
    current: config.snow.auth,
    properties: {
      answer: {
        pattern: /^.+$/,
        description: colors.green('Enter your password'),
        required: true,
        hidden: true
      }
    }
  },{
    attr: 'application.name',
    current: config.application.name,
    properties: {
      answer: {
        pattern: /^[a-zA-Z0-9-\s_]+$/,
        description: colors.green('Enter an application name'),
        required: true
      }
    }
  },{
    attr: 'application.scope',
    current: config.application.scope,
    properties: {
      answer: {
        pattern: /^[a-zA-Z0-9-]+$/,
        description: colors.green('Enter an application scope'),
        required: true
      }
    }
  }];


  if (!prompts[prompt_num]){
    success();
    return;
  }

  if (!prompts[prompt_num].current || prompts[prompt_num].current == '' || !prompts[prompt_num].properties.answer.pattern.test(prompts[prompt_num].current)){
    prompt.get(prompts[prompt_num], function(err,result){
      if (err){
        error(err);
        return;
      }
      if (!result){
        error("Configuration check failed.");
        return;
      }
      var p = prompts[prompt_num];
      var attr = set_property(config,p.attr,result.answer);
      attr = result.answer;

      prompt_num++;
      check_config(success,error,prompt_num);
    });

  } else {
    prompt_num++;
    check_config(success,error,prompt_num);
  }
}



function run(){

  // if there is a name and scope but no sys_id...then let's find or make it...
  if (config.application && config.application.name !== '' && config.application.scope !== '' && !config.application.sys_id){

    console.log("Checking instance configuration.");

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

            var rawData = '';
            res.on('data', (chunk) => rawData += chunk );
            res.on('end', () => {
              console.log(colors.red('The scope "' + config.application.scope + '" already exists. Continuing with automated setup could overwrite data or otherwise make it inaccessible.\nTHIS COULD BREAK ANY CURRENT UI PAGES, UI SCRIPTS, OR CONTENT CSS IN THE SCOPE IF THEY HAVE THE SAME NAME.'));
              prompt.get({
                properties: {                  
                  confirm: {
                    pattern: /^(yes|no|y|n)$/gi,
                    description: colors.yellow('Are you sure you want to continue auto setup? (y/N)'),
                    required: false,
                    default: ''
                  }
                }
              }, function (err, result){
                if (!result){
                  console.log('Exiting');
                  return;
                }
                var c = result.confirm.toLowerCase();
                if (c!='y' && c!='yes'){
                  console.log('Exiting.');
                  return;
                }

                var record = JSON.parse(rawData).result[0];
                config.application.name = record.name;
                config.application.sys_id = record.sys_id;
                create_files();
                  
              });

            });

          } else if (statusCode !== 404){
            console.log("Something went wrong trying to check for the scope. HTTP Code: " + statusCode);

          } else {
            create_scope();

          }


      });
      req.end();

    },function(err){
      console.log("There was an error getting your company code (glide.appcreator.company.code) from the instance:",err);
    })
   



  } else {
    console.log("Either you have a sys_id already...or you have files...or you don't have an application name and scope. Either way...I'm exiting. Good day sir!\n");
  }
}


function create_scope(){
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
      create_files();
    });
  });
  req.write(JSON.stringify(body));
  req.end();
}


function create_files(){
  console.log("Creating files");
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
      script_name: "runtime",
      script: "",
      sys_class_name: "sys_ui_script",
      sys_package: config.application.sys_id,
      name: config.application.scope + ".runtime",
      sys_name: config.application.scope + ".runtime",
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
          if (file.body.name == config.application.scope + '.main')      config.files.js['main'] = record.sys_id;
          if (file.body.name == config.application.scope + '.runtime')    config.files.js['runtime'] = record.sys_id;
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

function set_property(obj, prop, value) {
    if(typeof obj === 'undefined') return false;

    var _index = prop.indexOf('.');
    if(_index > -1) return set_property(obj[prop.substring(0, _index)], prop.substr(_index + 1), value);

    obj[prop] = value;
    return obj;
}
