var noble = require('noble');
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var async = require('async');
var StringDecoder = require('string_decoder').StringDecoder;

var decoder = new StringDecoder('utf8');


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
        var serviceIndex = 0;

        //  async.whilst(
        //    function () {
        //      return (serviceIndex < services.length);
        //    },
        //    function(callback) {
        //      var service = services[serviceIndex];
        //      var serviceInfo = service.uuid;
         //
        //      if (service.name) {
        //        serviceInfo += ' (' + service.name + ')';
        //      }
        //      console.log(serviceInfo);
         //
        //      service.discoverCharacteristics([], function(error, characteristics) {
        //        var characteristicIndex = 0;
         //
        //        async.whilst(
        //          function () {
        //            return (characteristicIndex < characteristics.length);
        //          },
        //          function(callback) {
        //            var characteristic = characteristics[characteristicIndex];
        //            var characteristicInfo = '  ' + characteristic.uuid;
         //
        //            if (characteristic.name) {
        //              characteristicInfo += ' (' + characteristic.name + ')';
        //            }
         //
        //            async.series([
        //              function(callback) {
        //                characteristic.discoverDescriptors(function(error, descriptors) {
        //                  async.detect(
        //                    descriptors,
        //                    function(descriptor, callback) {
        //                      return callback(descriptor.uuid === '2901');
        //                    },
        //                    function(userDescriptionDescriptor){
        //                      if (userDescriptionDescriptor) {
        //                        userDescriptionDescriptor.readValue(function(error, data) {
        //                          if (data) {
        //                            characteristicInfo += ' (' + data.toString() + ')';
        //                          }
        //                          callback();
        //                        });
        //                      } else {
        //                        callback();
        //                      }
        //                    }
        //                  );
        //                });
        //              },
        //              function(callback) {
        //                    characteristicInfo += '\n    properties  ' + characteristic.properties.join(', ');
         //
        //                if (characteristic.properties.indexOf('read') !== -1) {
        //                  characteristic.read(function(error, data) {
        //                    if (data) {
        //                      var string = data.toString('ascii');
         //
        //                      characteristicInfo += '\n    value       ' + data.toString('hex') + ' | \'' + string + '\'';
        //                    }
        //                    callback();
        //                  });
        //                } else {
        //                  callback();
        //                }
        //              },
        //              function() {
        //                console.log(characteristicInfo);
        //                characteristicIndex++;
        //                callback();
        //              }
        //            ]);
        //          },
        //          function(error) {
        //            serviceIndex++;
        //            callback();
        //          }
        //        );
        //      });
        //    },
        //    function (err) {
        //      peripheral.disconnect();
        //    }
        //  );



        console.log('discovering the following services: ')

        for(var i in services) {
          console.log(' ' + i + ' uuid: ' + services[i].uuid);
          console.log('characteristics: ');

          services[i].discoverCharacteristics(['2221'], function(error ,characteristic) {

            var moodValueCharact = characteristic[0];
            var dataSet = "";
            var outputObj = {};
            moodValueCharact.on('data', function(data, isNotification) {
              var textChunk = decoder.write(data); // Data comes as a byte bufferm so we have to convert it to a string


              if(textChunk.charCodeAt(0) === 0x02) {
                // console.log("beginning found!");
                dataSet = textChunk.substr(2);
              }
              else if(textChunk.indexOf(String.fromCharCode(0x03)) >= 0) {
                // console.log("end found!");
                dataSet += textChunk.substr(0, textChunk.indexOf(String.fromCharCode(0x03)));
                // console.log("New DataSet: " + dataSet);
                outputObj = JSON.parse(dataSet.substr(1,dataSet.length-1));
                console.log("outputObj: ", outputObj);
              } else {
                dataSet += textChunk;
              }



              //io.emit('mood data', data.readFloatBE(0));
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
