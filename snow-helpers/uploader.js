var fs = require('fs');
var http = require('https');

// get the configuration file...
var config = JSON.parse(fs.readFileSync('./snow.conf.json'));


if (config.snow && config.snow.username && config.snow.password){
  config.snow.auth = "Basic " + new Buffer(config.snow.username + ":" + config.snow.password).toString('base64');
  delete config.snow.username;
  delete config.snow.password;
  fs.writeFile("./snow.conf.json",JSON.stringify(config,null,2));
}


if (config.snow.instance == '' || config.snow.auth == ''){
  console.log("Please enter servicenow information in snow.conf.json");
  return;
}


var md5s = {};

var indexFile;

fs.readdir("./dist",function(err,files){

  for (var i=0; i < files.length; i++){
    var file = files[i]; 
    var match;
    if (file.match(/^index.html$/g)){
      indexFile = file;
      if (Object.keys(md5s).length == 4) upload_file(indexFile,'sys_ui_page',config.files.html.index);

    } else if (match = file.match(/^main\.([0-9a-f]+)\.js$/)){
      md5s.main = match[1];
      upload_file(file,'sys_ui_script',config.files.js.main);
      if (Object.keys(md5s).length == 4 && indexFile) upload_file(indexFile,'sys_ui_page',config.files.html.index);

    } else if (match = file.match(/^polyfills\.([0-9a-f]+)\.js$/)){
      md5s.polyfills = match[1];
      upload_file(file,'sys_ui_script',config.files.js.polyfills);
      if (Object.keys(md5s).length == 4 && indexFile) upload_file(indexFile,'sys_ui_page',config.files.html.index);
    
    } else if (match = file.match(/^runtime\.([0-9a-f]+)\.js$/)){
      md5s.runtime = match[1];
      upload_file(file,'sys_ui_script',config.files.js.runtime);
      if (Object.keys(md5s).length == 4 && indexFile) upload_file(indexFile,'sys_ui_page',config.files.html.index);
    
    } else if (match = file.match(/^styles\.([0-9a-f]+)\.css$/)){
      md5s.styles = match[1];
      upload_file(file,'content_css',config.files.css.styles);
      if (Object.keys(md5s).length == 4 && indexFile) upload_file(indexFile,'sys_ui_page',config.files.html.index);

    }
  }

});



function upload_file(file,table,sys_id){

  console.log("Uploading: ",file);

  var fields = {
    content_css: "style",
    sys_ui_page: "html",
    sys_ui_script: "script"
  };

  var options = {
    host: config.snow.instance,
    path: '/api/now/v1/table/' + table + '/' + sys_id,
    method: 'PUT',
    headers: {
      "accept": 'application/json',
      "content-type": "application/json",
      "authorization": config.snow.auth
    }
  };


  var body = {};
  body[fields[table]] = fs.readFileSync('./dist/' + file).toString();

  if (table == 'sys_ui_page') {

    // strip some build stuff not needed for SNow
    body[fields[table]] = body[fields[table]].replace('<base href="/">','');
    body[fields[table]] = body[fields[table]].replace(/<link .*href="styles\.[0-9a-f]+\.css">/,'');
    body[fields[table]] = body[fields[table]].replace(/<\/head>/g,'<link href="{{styles}}.cssdbx?no-cache={{styles-md5}}" rel="stylesheet" type="text/css" /></head>');
    body[fields[table]] = body[fields[table]].replace(/(<link.*)\/>/g,"$1><\/link>");
    body[fields[table]] = body[fields[table]].replace(/<script.*src.*<\/script>/g,'');

    for (key in config.files.css){
      var check = '{{' + key + '}}';
      var regex = new RegExp(check,'g');
      body[fields[table]] = body[fields[table]].toString().replace(regex,config.files.css[key]);
    }
    for (key in md5s){
      var check = '{{' + key + '-md5}}';
      var regex = new RegExp(check,'g');
      body[fields[table]] = body[fields[table]].toString().replace(regex,md5s[key]);
    }

  }

  var req = http.request(options, function(res) {
    const statusCode = res.statusCode; 
    if (statusCode !== 200) {
      console.log("Upload failed with status code " + statusCode + " for file:",file);
      return;
    }

    var rawData = '';
    res.on('data', (chunk) => rawData += chunk );
    res.on('end', () => {
      console.log("Done uploading file " + file);
    });
  });
  req.write(JSON.stringify(body));
  req.end();

}
