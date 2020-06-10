"use strict";

const Homey = require('homey');
const util = require('/lib/util.js');

class Shellyi3Driver extends Homey.Driver {

  onPair(socket) {
    const discoveryStrategy = this.getDiscoveryStrategy();
    const discoveryResults = discoveryStrategy.getDiscoveryResults();
    let selectedDeviceId;
    let deviceArray = {};

    socket.on('list_devices', (data, callback) => {
      const devices = Object.values(discoveryResults).map(discoveryResult => {
        return {
          name: 'Shelly i3 ['+ discoveryResult.address +']',
          data: {
            id: discoveryResult.id,
          }
        };
      });
      if (devices.length) {
        callback(null, devices);
      } else {
        socket.showView('select_pairing');
      }
    });

    socket.on('list_devices_selection', (data, callback) => {
      callback();
      selectedDeviceId = data[0].data.id;
    });

    socket.on('get_device', (data, callback) => {
      const discoveryResult = discoveryResults[selectedDeviceId];
      if(!discoveryResult) return callback(new Error('Something went wrong'));

      util.sendCommand('/shelly', discoveryResult.address, '', '')
        .then(result => {
          deviceArray = {
            name: 'Shelly i3 ['+ discoveryResult.address +']',
            data: {
              id: discoveryResult.id,
            },
            settings: {
              address  : discoveryResult.address,
              username : '',
              password : ''
            },
            store: {
              type: result.type
            }
          }
          if (result.auth) {
            socket.showView('login_credentials');
          } else {
            socket.showView('add_device');
          }
        })
        .catch(error => {
          callback(error, false);
        })
    });

    socket.on('login', (data, callback) => {
      deviceArray.settings.username = data.username;
      deviceArray.settings.password = data.password;
      callback(null, true);
    });

    socket.on('add_device', (data, callback) => {
      callback(false, deviceArray);
    });

    socket.on('manual_pairing', function(data, callback) {
      util.sendCommand('/settings', data.address, data.username, data.password)
        .then(result => {
          var hostname = result.device.hostname;
          if (hostname.startsWith('shelly1-')) {
            deviceArray = {
              name: 'Shelly i3 ['+ data.address +']',
              data: {
                id: result.device.hostname,
              },
              settings: {
                address  : data.address,
                username : data.username,
                password : data.password
              },
              store: {
                type: result.device.type
              }
            }
            callback(null, result);
          } else {
            callback(null, 'incorrect device');
          }
        })
        .catch(error => {
          callback(error, null);
        })
    });

  }

}

module.exports = Shellyi3Driver;