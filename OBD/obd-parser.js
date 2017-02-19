'use strict';

const SerialPort = require('serialport');

const PIDModes = require('./PID/pid-modes');
const PIDTable = require('./PID/pid-table');
const PIDTableProcessList = require('./PID/pid-table-process-list');
const AvailablePIDs = require('./PID/available-pids');


class OBDParser {
	constructor (port, baudRate, openCallback = function(){}, errorCallback = function() {}) {
		this._buffer = Buffer.from('');
		this._listeners = new Map();
		this._observers = [];
		this.availablePIDs = null;

		this._sp = new SerialPort(port, {
			baudRate,
			autoOpen: false,
		});

		this._sp.on('open', () => {
			this.sendCommand('AT Z');

			this.availablePIDs = new AvailablePIDs(this.sendCommand.bind(this));
			this.addMessageListener(this.availablePIDs.addResponse, PIDModes.RT.read, PIDTable.BASE_SUPPORT);

			//this.availablePIDs.initialize();

			openCallback();
		});

		this._sp.on('data', this._processData.bind(this));
		this._sp.open((error) => errorCallback(error));
	}

	_getIndex () {
		const index = OBDParser.bufferDelimiters
			.reduce(
				(index, delimiter) => {
					const i = this._buffer.indexOf(delimiter);
					return (i > -1) ? Math.min(i, index) : index;
				},
				Number.MAX_SAFE_INTEGER
			);

		return (index < Number.MAX_SAFE_INTEGER) ? index : -1;
	}

	_processData (data) {
		let index;
		this._buffer = Buffer.concat([ this._buffer, data ]);

		while ((index = this._getIndex()) > -1) {
			if (index < this._buffer.length) {
				const line = this._buffer.slice(0, index+1).toString();
				this._buffer = this._buffer.slice(index+1, this._buffer.length);

				this._notify(line);
			}
			else {
				console.log('Index Error');
			}
		}
	}


	_notifyAllMessages (line) {
		this._listeners.get( OBDParser.MESSAGE_ALL )
			.forEach((listener) => listener(line));
	}

	_notify (line) {
		this._notifyAllMessages(line);

		const response = line.split(' ');

		const messageType = response.shift();
		if  (!(messageType in PIDTableProcessList)) {
			return;
		}


		while (response.length) {
			const pidType = response.shift();

			if (!(pidType in PIDTableProcessList[ messageType ])) {
				console.log('Unknown PID type found: ', pidType);
				continue;
			}


			const pidSpecs = PIDTableProcessList[ messageType ][ pidType ];

			for (let i = 0; i < pidSpecs.bytes; i++) {
				if (!response[i]) {
					let errorMessage = `Error - empty value for PID '${pidType}'`;

					for (const [key, value] of Object.entries(obj)) {
						if (value === pidType) {
							errorMessage = `Error - empty value for PID '${key}'`;
							break;
						}
					}

					console.log(errorMessage);
					throw new Error(errorMessage);
				}
			}


			let data = response.splice(0, pidSpecs.bytes)
				.filter((nonEmpty) => nonEmpty)
				.join('');

			console.log(`Recieved data for PID '${pidType}': ${data}`);

			const listenerType = `${messageType}_${pidType}`;

			if (this._listeners.has(listenerType)) {
				data = pidSpecs.transform(data);

				this._listeners.get(listenerType)
					.forEach((listener) => listener(data));
			}
		}
	}

	sendCommand (command) {
		this._sp.write(Buffer.from(command + OBDParser.bufferDelimiters[0]));
	}

	addObserver (mode = PIDModes.RT, pids = []) {
		/* TODO: add check if exists
		if (!(mode in PIDModes)) {
			return null;
		}
		*/

		const command = [ mode.send ].concat(pids).join(' ');

		const interval = setInterval(() => this.sendCommand(command), 225);

		this._observers.push(interval);
		return interval;
	}

	removeObserver (interval) {
		const index = this._observers.indexOf(interval);
		if (index > -1) {
			clearInterval(interval)
			this._observers.splice(index, 1);
		}
		// TODO: change to map & add checking without interval reference
	}

	addMessageListener (listener, mode = OBDParser.MESSAGE_ALL, pid = null) {
		let type = mode;
		if (pid) {
			type += '_' + pid;
		}

		if (!this._listeners.has(type)) {
			this._listeners.set(type, []);
		}

		const list = this._listeners.get(type);
		if (!list.includes(listener)) {
			list.push(listener);
		}
	}

	removeMessageListener (listener, mode = OBDParser.MESSAGE_ALL, pid = null) {
		let type = mode;
		if (pid) {
			type += '_' + pid;
		}

		if (!this._listeners.has(type)) {
			return;
		}

		const list = this._listeners.get(type);
		const index = list.indexOf(listener);
		if (index > -1) {
			list.splice(index, 1);
		}
	}

	static listAvailablePorts (callback) {
		let portsList = [];
		SerialPort.list((err, ports) => callback(ports.map((port) => port.comName)));
	}
}

// static methods
OBDParser.bufferDelimiters = ['\r', '\n'];
OBDParser['MESSAGE_ALL'] = 'messages_all';

module.exports = OBDParser;
