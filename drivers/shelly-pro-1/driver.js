'use strict';

const Homey = require('homey');
const Driver = require('../driver.js');
const Util = require('../../lib/util.js');

class ShellyPro1Driver extends Driver {

  onInit() {
    if (!this.util) this.util = new Util({homey: this.homey});

    this.config = {
      name: 'Shelly Pro 1',
      battery: false,
      hostname: ['ShellyPro1-']
    }
  }

}

module.exports = ShellyPro1Driver;