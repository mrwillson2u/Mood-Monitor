var noble = require('noble');
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');



noble.on('stateChange', function(state) {

  if (state === 'poweredOn') {
    noble.startScanning();
    console.log('Scanning...');
  }
  else {
    noble.stopScanning();
    console.log('Stopped scanning.');
  }
})



noble.on('discover', function(peripheral) {

  // If it is the right bluetooth device, lets connect to it
  if(peripheral.advertisement.localName === 'MoodSweater') {
    console.log('Found device with local name: ' + peripheral.advertisement.localName)
    console.log('UUID: ' + peripheral.uuid);
    console.log('advertising the following service uuid\'s: ' + peripheral.advertisement.serviceUuids)
    console.log();

    var datetime = new Date();

    peripheral.connect(function(error) {
      console.log('connected to peripheral: ' + peripheral.advertisement.localName);
      peripheral.discoverServices(null,function(error, services) {

        console.log('discovering the following services: ')

        for(var i in services) {
          console.log(' ' + i + ' uuid: ' + services[i].uuid);
          console.log('characteristics: ');

          services[i].discoverCharacteristics(['2221'], function(error ,characteristic) {

            var moodValueCharact = characteristic[0];
            
            //JJR - create a log file. Doing this here so we can write header info in the file that describes what format the CSV data is in
						//First create logs subdirectory. NOTE: there is no mkdir -p option (i.e. create it if it doesn't already exist) for Node.js, 
						//	so we have to just do a mkdir and then handle the error (and ignore it) if the directory already exists. 
						var dir = 'logs/';
						fs.mkdir( dir, 0o755, function(err) {		
							if(err) {
								if(err.code === 'EEXIST'); //ignore; if dir exists, then we are good.
								else	console.log('Failed to create directory: ' + dir);	//some other error happened
							} else ;	//directory successfully created
						});
						
						//Create the log file, with headers
						var logfilename = 'save_' + datetime.getFullYear() + '-' + (datetime.getMonth()+1) + '-' + datetime.getDate() + '_' + datetime.getHours() + '-' + datetime.getMinutes() + '-' + datetime.getSeconds() + '.txt';
						var logfilepath = dir + logfilename;
						fs.appendFile(logfilepath, 'Timestamp_(ms),' + 'Battery_Level_(V)' + '\n');
						console.log('Creating log file: ' +  logfilepath);
						
						
            moodValueCharact.on('read', function(data, isNotification) {
            	var strData = data.toString('ascii');
            	var timestamp_ms = new Date().getTime();	//time in milliseconds since jan 1, 1970
            	
            	//Battery level data
            	console.log('Data string CSV ( timestamp (ms), Battery Level (V) ): ' + timestamp_ms + ',' + strData);
            	fs.appendFile(logfilepath, timestamp_ms + ',' + strData + '\n');

            	
            	//JJR - CSV smoothMood data for Oksana
            	//console.log('Data string CSV (timstamp, smoothMood, R, G, B): ' + timestamp_ms + ',' + strData);
            	//fs.appendFile('save_' + datetime.getFullYear() + '-' + (datetime.getMonth()+1) + '-' + datetime.getDay() + '_' + datetime.getHours() + ':' + datetime.getMinutes() + ':' + datetime.getSeconds() + '.txt', timestamp_ms + ',' + strData + '\n');
              
              //JJR - colin's original code:
              //console.log('moodValue: ' + data.readUInt16LE(0));
              //io.emit('mood data', data.readUInt16LE(0));
              //fs.appendFile('save_' + datetime.getMonth() + '-' + datetime.getDay() + '-' + datetime.getYear() + '_' + datetime.getHours() + ':' + datetime.getMinutes() + ':' + datetime.getSeconds() + '.txt', data.readUInt16LE(0) + ',' + datetime + '\n');
              //console.log(datetime.getMonth() + '-' + datetime.getDay() + '-' + datetime.getYear() + '_' + datetime.getHours() + ':' + datetime.getMinutes() + ':' + datetime.getSeconds());
            })

            moodValueCharact.notify(true, function() {
              console.log('mood notification on!');
            })

            // moodValueCharact.read(function(error, data) {
            //     if(error) {
            //       console.log('error: ' + error)
            //     }
            //     else {
            //       console.log(' uuid: ' + characteristic[0].uuid + ' with value: ' + data);
            //     }
            //   });
            });
          }
        });
    });
  }
});
app.use(express.static('html'));

app.get('/', function(req, res) {
  // res.send('<h1>Hello World</h1>');

  var options = {
    root: __dirname + '/html/'
  };

  res.sendFile('index.html', options);
});

io.on('connection', function(socket) {
  console.log('A user connected.');
  socket.on('disconnect', function() {
    console.log('A user disconnected');
  });
});

//   socket.on('chat message', function(msg) {
//     console.log('message: ' + msg);
//     io.emit('chat message', msg);
//   });
// });

http.listen(3000, function() {
  console.log('listening on *:3000');
});
