var noble = require('noble');
var app = require('express')();
var express = require('express');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs');
var open = require('open');
// var async = require('async');

var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var connectedToPeriph = false;
var clients = [];
var  scanning = false;
var moodSweaterUUID = "7ea37786515c43cf8c3355d45541c0b3";


app.use(express.static('html'));

app.get('/', function(req, res) {
  // res.send('<h1>Hello World</h1>');

  var options = {
    root: __dirname + '/html/'
  };

  res.sendFile('index.html', options);
});

server.listen(3000, function() {
  console.log('listening on *:3000');
});


open('http://localhost:3000/', function (err) {
  if (err) throw err;
  console.log('The user closed the browser, exiting program.');
});


function scanForBle() {
  console.log('Scanning...');
  // noble.startScanning(["7ea37786515c43cf8c3355d45541c0b3"], false);
  noble.startScanning();
  scanning = true;
}

function stopScanningBle() {
  console.log('Stopped scanning.');
  noble.stopScanning();
  scanning = false;
}

io.on('connection', function(socket) {
  console.log('A user connected.');
  clients.push(socket);

  socket.on('disconnect', function() {
    console.log('A user disconnected');
    clients.splice(clients.indexOf(socket), 1);

    if(clients.length === 0) {
      console.log("No more clients. Exiting application");
      process.exit(1);
    }
  });

  if(noble.state === "poweredOn" && !scanning) {
    scanForBle();
  }

  console.log('noble.state: ', noble.state);

  noble.on('stateChange', function(state) {
    console.log("stateChange: ", state);
    console.log("scanning: ", scanning);
    if (state === 'poweredOn' && !scanning) {
      scanForBle();
    }
    else {
      stopScanningBle();
    }
  });

  function sendStatus(bleStatus) {
    socket.emit("ble_status", {status: bleStatus});
  }

  socket.on('ble-ctl', function(msg) {
    if(msg.cmd === "scan") {
      scanForBle();
    }
  });

  socket.on('MoodCommand', function(msg) {

    if(connectedToPeriph) {
      if(msg.cmd == "register") {
        console.log("Registering");
        sendCommand("RGA", msg.data);
        socket.emit('register_status', {status: true});
      }
      else if(msg.cmd == "unregister") {
        console.log("Unregistering");
        sendCommand("URG");
        socket.emit('register_status', {status: false});
      }
      else if(msg.cmd == "transmit_data") {
        console.log("Getting Current Data");
        sendCommand("SCD");
      }
    }
    else {
      console.log("Not connected to perioheral!");
    }
  });





  var moodValueCharact = null;
  var commCharact = null;

  function sendCommand(txAction, txData) {
    var sendBuffer = new Buffer(16);
    var STX = String.fromCharCode(0x02);
    var ETX = String.fromCharCode(0x03);
    var DLE = String.fromCharCode(0x10);

    var textStr = "";
    textStr += DLE;
    textStr += STX;
    textStr += txAction;
    textStr += ',';

    if(txData && typeof txData !== String) {
      var numStr = txData.toString();
      // If the string length is value is less than 8 characters, add '0' to fill
      while(numStr.length < 8) {
        var filler = "0";
        numStr = filler.concat(numStr);
      }
      console.log("Sending String: ", numStr);
      textStr += numStr;
    } else {
      textStr += "00000000";
    }
    textStr += DLE;
    textStr += ETX;

    // sendBuffer.write(textStr, 0);
    sendBuffer.write(textStr, 0, "utf-8");
    for (var value of sendBuffer.values()) {
      console.log(value);
    }
    commCharact.write(sendBuffer, false);
  };




  noble.on('discover', function(peripheral) {
  noble.stopScanning();

    // If it is the right bluetooth device, lets connect to it
    if(peripheral.advertisement.localName === 'MoodSweater') {
      console.log('Found device with local name: ' + peripheral.advertisement.localName)
      console.log('UUID: ' + peripheral.uuid);
      console.log(typeof peripheral.uuid);
      console.log('advertising the following service uuid\'s: ' + peripheral.advertisement.serviceUuids)
      console.log();


      var datetime = new Date();
      peripheral.connect(function(error) {
        noble.stopScanning();
        console.log('connected to peripheral: ' + peripheral.advertisement.localName);


        peripheral.discoverServices(['2220'],function(error, services) {
          var serviceIndex = 0;

          console.log('discovering the following services: ')

          //for(var i in services) {
          services.forEach(function(service) {
            console.log('uuid: ' + service.uuid);
            service.discoverCharacteristics([], function(error, characteristics) {


                moodValueCharact = characteristics[0];
                commCharact = characteristics[1];


                // console.log('moodValueCharact: ', moodValueCharact);
                var dataSet = "";
                var outputObj = {};
                var recievingDataSet = false;


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
                });


                moodValueCharact.notify(true, function() {

                  console.log('mood notification on!');
                  connectedToPeriph = true;
                  sendStatus("connected");

                });
                // moodValueCharact.notify(false, function() {
                //
                //   console.log('mood notification off!');
                //   connectedToPeriph = false;
                //   sendStatus("disconnected");
                //
                // });



              // }

            }); // service.discoverCharacteristics
          }); // services.forEach
        }); // peripheral.discoverServices
      }); // peripheral.connect(

      peripheral.once('disconnect', function() {
        console.log("Disconnected from peripheral");
        // io.emit("ble_status", {status: "disconnected"})
        connectedToPeriph = false;
        // console.log("Scanning..");
        // noble.startScanning();
        // scanning = true;
        sendStatus("disconnected");
      });
    }
  }); // noble.on


  process.stdin.resume();//so the program will not close instantly

  function exitHandler(options, err) {
      sendCommand("URG");
      socket.emit("program_exited");
      if (options.cleanup) console.log('clean');
      if (err) console.log(err.stack);
      if (options.exit) process.exit();

  }

  //do something when app is closing
  process.on('exit', exitHandler.bind(null,{cleanup:true}));

  //catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, {exit:true}));

  //catches uncaught exceptions
  //process.on('uncaughtException', exitHandler.bind(null, {exit:true}));


});
