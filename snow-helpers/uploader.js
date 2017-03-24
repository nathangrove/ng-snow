var fs = require('fs');
var http = require('https');
var colors = require("colors/safe");

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
    for (key in config.files.css)
      body[fields[table]] = body[fields[table]].toString().replace('</head>','<link href="' + config.files.css[key] + '.cssdbx" rel="stylesheet" type="text/css"></link></head>');
    

    // strip some build garabage
    body[fields[table]] = body[fields[table]].replace('<base href="/">','');
    body[fields[table]] = body[fields[table]].replace(/<(?:script|link).*(?:src|href)=['"]+(?!http).*\.[js|css]+.*(?:\/>|script>)/g,'');
  }

  console.log("Managing images for file: " + file);
  manage_images(body[fields[table]],function(updated_content){
    body[fields[table]] = updated_content;

    var req = http.request(options, function(res) {
      const statusCode = res.statusCode; 
      if (statusCode !== 200) {
        console.log(colors.red("Upload failed with status code " + statusCode + " for file:",file));
        return;
      }

      var rawData = '';
      res.on('data', (chunk) => rawData += chunk );
      res.on('end', () => {
        console.log(colors.green("Done uploading file " + file));
      });
    });
    req.write(JSON.stringify(body));
    req.end();

  },function(err){
    console.log("Image management of " + file + " failed. Uploading as is.");
    var req = http.request(options, function(res) {
      const statusCode = res.statusCode; 
      if (statusCode !== 200) {
        console.log(colors.red("Upload failed with status code " + statusCode + " for file:",file));
        return;
      }

      var rawData = '';
      res.on('data', (chunk) => rawData += chunk );
      res.on('end', () => {
        console.log(colors.green("Done uploading file " + file));
      });
    });
    req.write(JSON.stringify(body));
    req.end();

  });

}



/*
  Image managing functions
*/


function manage_images(content,success,error){

  var images = [];
  var uploaded_images = [];
  var completed = 0;


  var regex = /((?!http)[^"|'|(]+(?:..\/)*\.(?:jpg|png|bmp|gif|jpeg|ico|svg)+)\\?(?=["')])/ig;
  var m;
  while ((m = regex.exec(content)) !== null) {
      if (m.index === regex.lastIndex) regex.lastIndex++;
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex == 1) images.push(match);
      });
  }

  images = images.filter(function(elem, pos) { return images.indexOf(elem) == pos; });
  if (images.length == 0){ success(content); return; }

  for (var i=0; i < images.length; i++){

    var filename = images[i];
    filename = filename.replace(/\.\.\//g,'');
    if (filename.indexOf('/') == 0) filename = './dist' + filename;
    else filename = './dist/' + filename;

    if (!fs.existsSync(filename)){
      console.log(colors.yellow("Image: " + filename + " does not exist. Skipping it."));
      completed++;

      if (completed == images.length){
        delete_unused_images(uploaded_images,function(){ 
          success(content); 
        });
      }

      continue;
    } 

    (function(image){
      upload_image(filename,function(new_name){
        console.log(image + " has been successfully uploaded");
        
        var re = new RegExp(image.replace('.','\.').replace('/','\/'),'g');
        content = content.replace(re,new_name+"x");

        uploaded_images.push(new_name);
        completed++;

        if (completed == images.length){
          delete_unused_images(uploaded_images,function(){ 
            success(content); 
          });
        }

      },function(err){
        error(image + " Error: ",err);
      });
    })(images[i]);

  }


}


function delete_unused_images(uploaded_images,callback){
  // TODO: implement
  callback();
}


  function upload_image(file,success,error){

    var image = fs.readFileSync(file);
    console.log("Uploading image: ",file);

    // convert the file url into a snowname
    var filename = config.application.scope + "." + file.replace(/^[\.\/]+|dist\//g,'').replace(/\//g,'.');
    var size = image.byteLength;
    var format = filename.substr(filename.lastIndexOf('.') + 1);

    get_db_image_record(filename,size,format,function(sys_id){
      upload(image,sys_id,function(){
        success(filename);
      },function(err){
        error(err);
      }); 
    },function(err){
      console.log("db_image record fetching/creation failed with error: ",err);
    });

  }




  function upload(image,sys_id,success,error){

    var options = {
      host: config.snow.instance,
      path: '/api/now/v1/attachment/file?table_name=db_image&table_sys_id='+sys_id+'&file_name=image',
      method: 'POST',
      headers: {
        "Authorization": config.snow.auth,
        "Content-Type": "image/png",
        "Accept": "application/json"
      }
    };

    var req = http.request(options, function(res) {
      const statusCode = res.statusCode; 
      if (statusCode !== 201) {
        error("Image upload failed with status code " + statusCode + " for image: " + file);
        return;
      }

      var rawData = '';
      res.on('data', (chunk) => rawData += chunk );
      res.on('end', () => {
        success();
      });
    });

    //image.pipe(req);
    req.write(image);
    req.end();
  }


  function get_db_image_record(filename,size,format,success,error){
    var options = {
      host: config.snow.instance,
      path: '/api/now/v1/table/db_image?sysparm_query=name=' + filename,
      method: 'GET',
      headers: {
        "accept": 'application/json',
        "authorization": config.snow.auth
      }
    };

    var req = http.request(options, function(res){
      const statusCode = res.statusCode; 
      if (statusCode !== 200) {
        create_db_image_record(filename,size,format,function(sys_id){
          success(sys_id);
        },function(err){
          error(err);
        });
        return;
      }

      var rawData = '';
      res.on('data', (chunk) => rawData += chunk );
      res.on('end', () => {
        var result = JSON.parse(rawData).result;
        success(result[0].sys_id);
      });

    });
    req.end();
  }

  function create_db_image_record(filename,size,format,success,error){
    var options = {
      host: config.snow.instance,
      path: '/api/now/v1/table/db_image',
      method: 'POST',
      headers: {
        "accept": 'application/json',
        "authorization": config.snow.auth
      }
    };
    var body = {
      name: filename,
      size_bytes: size,
      format: format,
      sys_scope: config.application.sys_id,
      sys_customer_update: 'true'
    };

    var req = http.request(options, function(res){

      var rawData = '';
      res.on('data', (chunk) => rawData += chunk );
      res.on('end', () => {
        const statusCode = res.statusCode; 
        if (statusCode !== 201) {
            error("Image upload failed trying to create the db_image record:\n" + rawData);
        } else {
          var result = JSON.parse(rawData).result;
          success(result.sys_id);
        }
      });

    });

    req.write(JSON.stringify(body));
    req.end();
  }
