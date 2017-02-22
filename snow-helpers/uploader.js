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


fs.readdir("./dist",function(err,files){

  for (var i=0; i < files.length; i++){
    var file = files[i]; 
    if (file.match(/^index.html$/g)){
      upload_file(file,'sys_ui_page',config.files.html.index);

    } else if (file.match(/^main\.[0-9a-z]+\.bundle\.js$/)){
      upload_file(file,'sys_ui_script',config.files.js.main);

    } else if (file.match(/^inline\.[0-9a-z]+\.bundle\.js$/g)){
      upload_file(file,'sys_ui_script',config.files.js.inline);
    
    } else if (file.match(/^polyfills\.[0-9a-z]+\.bundle\.js$/g)){
      upload_file(file,'sys_ui_script',config.files.js.polyfills);
    
    } else if (file.match(/^vendor\.[0-9a-z]+\.bundle\.js$/g)){
      upload_file(file,'sys_ui_script',config.files.js.vendor);
    
    } else if (file.match(/^styles\.[0-9a-z]+\.bundle\.css$/g)){
      upload_file(file,'content_css',config.files.css.styles);
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
    for (key in config.files.css){
      var check = '{{' + key + '}}';
      var regex = new RegExp(check,'g');
      body[fields[table]] = body[fields[table]].toString().replace(regex,config.files.css[key]);
    }

    // strip some build garabage
    body[fields[table]] = body[fields[table]].replace('<base href="/">','');
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
