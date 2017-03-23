var http = require('https');
var config = require("../snow.conf.json");
var fs = require('fs');

var options = {
  host: config.snow.instance,
  path: '/api/now/v1/attachment/file?table_name=db_image&table_sys_id=56a8dc7f0fa13200ebad3e4ce1050ed4&file_name=image',
  method: 'POST',
	headers: {
		"Authorization": config.snow.auth,
		"Content-Type": "image/png",
		"Accept": "application/json"
	}
}

var req = http.request(options, function(res) {
  const statusCode = res.statusCode; 
  if (statusCode !== 201) {
    console.log("Upload failed with status code " + statusCode + " for image");
  }

  var rawData = '';
  res.on('data', (chunk) => rawData += chunk );
  res.on('end', () => {
  	console.log(res.headers);
  	console.log(rawData);
    console.log("Done uploading image");
  });
});

var image = fs.readFileSync('./src/assets/img/sample2.png');//fs.createReadStream('./src/assets/sample.png', { encoding: 'binary' });
//image.pipe(req);
req.write(image);
req.end();

// function to encode file data to base64 encoded string
function base64_encode(file) {
    var bitmap = fs.readFileSync(file);
    return new Buffer(bitmap).toString('base64');
}