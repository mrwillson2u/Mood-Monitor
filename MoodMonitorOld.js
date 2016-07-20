var noble = require('noble');
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var async = require('async');
var StringDecoder = require('string_decoder').StringDecoder;

var decoder = new StringDecoder('utf8');

function scanForSignals() {
  noble.startScanning();
}

if (state === 'poweredOn') {
  scanForSignals();
}

noble.on('stateChange', function(state) {

  if (state === 'poweredOn') {
    scanForSignals();
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
        var serviceIndex = 0;



        console.log('discovering the following services: ')

        for(var i in services) {
          console.log(' ' + i + ' uuid: ' + services[i].uuid);
          console.log('characteristics: ');

          services[i].discoverCharacteristics(['2221'], function(error ,characteristic) {

            var moodValueCharact = characteristic[0];
            var dataSet = "";
            var outputObj = {};
            var recievingDataSet = false;

            function sendCommand(txAction, txData) {
              var sendBuffer = new Buffer.alloc(17);
              var STX = 0x02;
              var ETX = 0x03;
              var DLE = 0x10;

              sendBuffer.write(DLE + STX + txAction + DLE + DLE + txData + DLE + ETX, 0);
              moodValueCharact.write(sendBuffer, false);
            }


            moodValueCharact.on('data', function(data, isNotification) {
              var textChunk = decoder.write(data); // Data comes as a byte bufferm so we have to convert it to a string

              // If we see the start byte, we'll begin recieving a new set
              if(textChunk.charCodeAt(0) === 0x02 && !recievingDataSet) {
                console.log("beginning found!");
                recievingDataSet = true;
                dataSet = textChunk.substr(2);
              }
              // Otherwise if we see the end byte, we'll stop recieving and log the string
              else if(textChunk.indexOf(String.fromCharCode(0x03)) >= 0 && recievingDataSet) {
                console.log("end found!");
                recievingDataSet = false;
                dataSet += textChunk.substr(0, textChunk.indexOf(String.fromCharCode(0x03)));
                // console.log("New DataSet: " + dataSet);
                outputObj = JSON.parse(dataSet.substr(1,dataSet.length-1));
                io.emit("mood data", outputObj);
                console.log("outputObj: ", outputObj);
              } else if (recievingDataSet){
                dataSet += textChunk;
              }




              //fs.appendFile('save_' + datetime.getMonth() + '-' + datetime.getDay() + '-' + datetime.getYear() + '_' + datetime.getHours() + ':' + datetime.getMinutes() + ':' + datetime.getSeconds() + '.txt', data.readFloatBE(0) + ',' + datetime + '\n');
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
