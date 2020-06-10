'use strict';

const Homey = require('homey');
const util = require('/lib/util.js');

class Shelly25RollerShutterDevice extends Homey.Device {

  onInit() {
    this.pollDevice();
    this.setAvailable();

    // ADD MISSING CAPABILITIES
    if (!this.hasCapability('button.sethalfwayposition')) {
      this.addCapability('button.sethalfwayposition');
    }
    if (!this.hasCapability('button.callbackevents')) {
      this.addCapability('button.callbackevents');
    }
    if (!this.hasCapability('button.removecallbackevents')) {
      this.addCapability('button.removecallbackevents');
    }

    // LISTENERS FOR UPDATING CAPABILITIES
    this.registerCapabilityListener('windowcoverings_state', (value, opts) => {
      if (value !== 'idle' && value !== this.getStoreValue('last_action')) {
        this.setStoreValue('last_action', value);
      }

      if (value == 'idle') {
        return util.sendCommand('/roller/0?go=stop', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
      } else if (value == 'up') {
        return util.sendCommand('/roller/0?go=open', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
      } else if (value == 'down') {
        return util.sendCommand('/roller/0?go=close', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
      } else {
        return Promise.reject('State not recognized ...');
      }
    });

    this.registerCapabilityListener('windowcoverings_set', (value, opts) => {
      if (this.getSetting('halfway') == 0.5) {
        var position = value;
      } else {
        if (value > 0.5) {
          var position = -2 * value * this.getSetting('halfway') + 2 * value + 2 * this.getSetting('halfway') - 1;
        } else {
          var position = 2 * value * this.getSetting('halfway');
        };
      }

      return util.sendCommand('/roller/0?go=to_pos&roller_pos='+ Math.round(position*100), this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
    });

    this.registerCapabilityListener('button.sethalfwayposition', async () => {
      util.sendCommand('/status', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'))
        .then(result => {
          var position = result.rollers[0].current_pos >= 100 ? 1 : result.rollers[0].current_pos / 100;
          this.setSettings({'halfway':  position});
          return true;
        })
        .catch(error => {
          this.log(error);
          return false;
        })
    });

    this.registerCapabilityListener('button.callbackevents', async () => {
      var homeyip = await util.getHomeyIp();
      var roller_open_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_open_url=http://'+ homeyip +'/api/app/cloud.shelly/button_actions/shelly25/'+ this.getData().id +'/roller_open/';
      var roller_close_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_close_url=http://'+ homeyip +'/api/app/cloud.shelly/button_actions/shelly25/'+ this.getData().id +'/roller_close/';
      var roller_stop_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_stop_url=http://'+ homeyip +'/api/app/cloud.shelly/button_actions/shelly25/'+ this.getData().id +'/roller_stop/';
      
      try {
        await util.sendCommand(roller_open_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        await util.sendCommand(roller_close_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        await util.sendCommand(roller_stop_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        return;
      } catch (error) {
        throw new Error(error);
      }
    });

    this.registerCapabilityListener('button.removecallbackevents', async () => {
      var roller_open_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_open_url=null';
      var roller_close_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_close_url=null';
      var roller_stop_url = '/settings/relay/'+ this.getStoreValue('channel') +'?roller_stop_url=null';
      var out_off_url = '/settings/relay/'+ this.getStoreValue('channel') +'?out_off_url=null';
      var shortpush_url = '/settings/relay/'+ this.getStoreValue('channel') +'?shortpush_url=null';
      var longpush_url = '/settings/relay/'+ this.getStoreValue('channel') +'?longpush_url=null';

      try {
        await util.sendCommand(roller_open_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        await util.sendCommand(roller_close_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        await util.sendCommand(roller_stop_url, this.getSetting('address'), this.getSetting('username'), this.getSetting('password'));
        return;
      } catch (error) {
        throw new Error(error);
      }
    });

  }

  onDeleted() {
    clearInterval(this.pollingInterval);
    clearInterval(this.pingInterval);
  }

  // HELPER FUNCTIONS
  pollDevice() {
    clearInterval(this.pollingInterval);
    clearInterval(this.pingInterval);

    this.pollingInterval = setInterval(() => {
      util.sendCommand('/status', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'))
        .then(result => {
          clearTimeout(this.offlineTimeout);

          if ( result.rollers[0].state == 'stop' ) {
            var state = 'idle';
          } else if ( result.rollers[0].state == 'open' ) {
            var state = 'up';
          } else if ( result.rollers[0].state == 'close' ) {
            var state = 'down';
          }
          if (state !== 'idle' && state !== this.getStoreValue('last_action')) {
            this.setStoreValue('last_action', state);
          }

          var power = result.rollers[0].power;
          var position = result.rollers[0].current_pos >= 100 ? 1 : result.rollers[0].current_pos / 100;

          if (this.getSetting('halfway') !== 0.5) {
            if (position < this.getSetting('halfway')) {
              var position = 0.5 * position / this.getSetting('halfway');
            } else {
              var position = position - (1 - (position-this.getSetting('halfway')) * (1 / (1 - this.getSetting('halfway')))) * (this.getSetting('halfway') - 0.5);
            };
          };

          // capability windowcoverings_state
          if (state != this.getCapabilityValue('windowcoverings_state')) {
            this.setCapabilityValue('windowcoverings_state', state);
          }

          // capability measure_power
          if (power != this.getCapabilityValue('measure_power')) {
            this.setCapabilityValue('measure_power', power);
          }

          // capability windowcoverings_set
          if (position != this.getCapabilityValue('windowcoverings_set')) {
            this.setCapabilityValue('windowcoverings_set', position);
          }

        })
        .catch(error => {
          this.log(error);
          this.setUnavailable(Homey.__('Unreachable'));
          this.pingDevice();

          this.offlineTimeout = setTimeout(() => {
            let offlineTrigger = new Homey.FlowCardTrigger('triggerDeviceOffline');
            offlineTrigger.register().trigger({"device": this.getName(), "device_error": error.toString() });
            return;
          }, 60000 * this.getSetting('offline'));
        })
    }, 1000 * this.getSetting('polling'));
  }

  pingDevice() {
    clearInterval(this.pollingInterval);
    clearInterval(this.pingInterval);

    this.pingInterval = setInterval(() => {
      util.sendCommand('/status', this.getSetting('address'), this.getSetting('username'), this.getSetting('password'))
        .then(result => {
          this.setAvailable();
          this.pollDevice();
        })
        .catch(error => {
          this.log('Device is not reachable, pinging every 63 seconds to see if it comes online again.');
        })
    }, 63000);
  }

}

module.exports = Shelly25RollerShutterDevice;
