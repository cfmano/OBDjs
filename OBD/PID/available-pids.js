'use strict';

class AvailablePIDs {
	constructor (sendCommand) {
		this._init();
		this.addResponse = this._addResponse.bind(this);
		this._sendCommand = sendCommand;
	}

	_init () {
		this._response = '';
		this._availablePIDs = [];
	}

	_addResponse (response) {
		this._response += response;
	}

	clear () {
		this._response = '';
		this._availablePIDs = [];
	}

	clean () {
		const sp = this._serialport;
		this.clear();
		this._init();
	}


	get (forceUpdate) {
		if (forceUpdate || this._availablePIDs.length) {
			this.determine();
		}
		return this._availablePIDs;
	}

	determine () {
		this._availablePIDs = Number.parseInt(this._response, 16)
			.toString(2)
			.split('')
			.map((i, index) => {
				return i === '1' && ('00' + index.toString(16)).substr(-2);
			})
			.filter((PID) => PID);

		return this._availablePIDs;
	}

	initialize () {
		this._sendCommand('01 00');
	}
}

module.exports = AvailablePIDs;
