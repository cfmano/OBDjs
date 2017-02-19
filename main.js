const SerialPort = require('serialport');


class Dashboard {
	constructor (window, logger) {
		this._elements = {};
		this._windowParams = window;

		this.logger = logger;
	}

	_bindEvents () {
		Object.assign(this._elements, {
			revMeter: document.querySelector('#revmeter .gauge'),
			speedMeter: document.querySelector('#speedmeter .gauge'),
		});
	}

	updateRpm (value) {
		this._elements.revMeter.style.setProperty('--rpm', value);
	}

	updateGear (value) {
		this._elements.revMeter.style.setProperty('--gear', value);
	}

	updateSpeed (value) {
		this._elements.speedMeter.style.setProperty('--kmh', Math.round(value));
	}

	open () {
		nw.Window.open(this._windowParams.viewFile, { focus: true }, (win) => {
			this.logger.log('dashboard window open');

			win.width = this._windowParams.width;
			win.height = this._windowParams.height;

			this.document = win.window.document;

			this.document.addEventListener('DOMContentLoaded', () => {
				this._bindEvents();
				this.logger.log('dashboard ready');
			});

			this.close = this._close.bind(this, win);
			win.on('close', this.close);
		});
	}

	_close () {
		this.logger.log('closing dashboard window');
		win.close(true);
	}
}





class Logger {
	constructor (outputElement) {
		this._outputInterval = 1000;
		this._outputElement = outputElement;
		this._output = [];

		this._run();
	}

	_run () {
		this._paused = false;
		this._interval = setInterval(this._makeOutput.bind(this), this._outputInterval);
	}

	pause () {
		this._paused = true;
		clearInterval(this._interval);
	}

	resume () {
		this._run();
	}

	isPaused () {
		return this._paused;
	}

	clean () {
		this._output.length = 0;
		this._outputElement.innerHTML = '';
	}

	log (message) {
		if (!this._paused) {
			this._output.push(message);
			return true;
		}
		else {
			return false;
		}
	}

	_makeOutput () {
		if (this._output.length && this._outputElement) {
			const newLine = this._output.shift().toString();

			const el = this._outputElement.ownerDocument.createElement('div');
			el.innerHTML = newLine;
			this._outputElement.appendChild(el);

			this._outputElement.scrollTop = this._outputElement.scrollHeight;

			if (this._output.length) {
				setTimeout(this._makeOutput.bind(this), this._outputInterval/84*(newLine.length+4));
			}
		}
	}
}





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





const PIDModes = {
	RT: {
		send: '01',
		read: '41',
	},
};

const PIDTable = {
	BASE_SUPPORT: '00',
	RPM: '0C',
	SPEED: '0D',
};

const PIDTableProcessList = {
	[ PIDModes.RT.read ]: {
		[ PIDTable.BASE_SUPPORT ]: {
			bytes: 4, // 8 total
			transform: data => data,
		},
		[ PIDTable.RPM ]: {
			bytes: 2,
			transform: (data) => (Number.parseInt(data, 16) / 4),
		},
		[ PIDTable.SPEED ]: {
			bytes: 1,
			transform: (data) => Number.parseInt(data, 16),
		},
	},
};



class OBDParser {
	constructor (port, baudRate, openCallback = function(){}, errorCallback = function() {}) {
		this._buffer = Buffer.from('');
		this._listeners = new Map();
		this.availablePIDs = null;

		this._sp = new SerialPort(port, {
			baudRate,
			autoOpen: false,
		});

		this._sp.on('open', () => {
			this.sendCommand('AT Z');

			//this.sendCommand('AT SP 0');

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
		console.log(line);
		this._notifyAllMessages(line);

		const response = line.split(' ');
		console.log(response);

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


			const data = response.splice(0, pidSpecs.bytes)
				.filter((nonEmpty) => nonEmpty)
				join('');

			console.log(`Recieved data for PID '${pidType}': ${data}`);

			const listenerType = `${messageType}_${pidType}`;

			if (this._listeners.has(listenerType)) {
				this._listeners.get(listenerType)
					.forEach((listener) => listener(
						pidSpecs.transform(data)
					));
			}
		}
	}

	sendCommand (command) {
		this._sp.write(Buffer.from(command + OBDParser.bufferDelimiters[0]));
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

	static listAvailablePorts (callback) {
		let portsList = [];
		SerialPort.list((err, ports) => callback(ports.map((port) => port.comName)));
	}
}

// static methods
OBDParser.bufferDelimiters = ['\r', '\n'];
OBDParser['MESSAGE_ALL'] = 'messages_all';





class Application {
	constructor (window) {
		this._windowParams = window;
		this._elements = {};

		this.run();
	}

	run () {
		nw.Window.open(this._windowParams.viewFile, { focus: true }, (win) => {
			win.width = this._windowParams.width;
			win.height = this._windowParams.height;

			this.document = win.window.document;

			this.document.addEventListener('DOMContentLoaded', this._windowOpenCallback.bind(this));
		});
	}

	_addLogger () {
		const { document } = this;

		this.logger = new Logger(document.querySelector('#output'));

		const cleanOutputButton = document.querySelector('input[type="reset"]');
		const playPauseButton = document.querySelector('#play-pause');

		cleanOutputButton.addEventListener('click', () => this.logger.clean());

		playPauseButton.addEventListener('click', (event) => {
			const button = event.target;

			if (this.logger.isPaused()) {
				this.logger.resume();
				button.value = 'Pause';
			}
			else {
				this.logger.pause();
				button.value = 'Resume';
			}
		});
	}

	_openDashboard (event) {
		event.target.disabled = true;
		this.logger.log('opening dashboard...');

		if (this._dashboard) {
			this._dashboard.close();
		}

		this._dashboard = new Dashboard({
			viewFile: 'dashboard.html',
			width: 1180,
			height: 540,
		});

		this._dashboard.open();
	}

	_sendCommand (event) {
		event.preventDefault();

		const { commandInput } = this._elements;

		console.log(`sending manual command '${commandInput.value}'`);
		this.obdParser.sendCommand(commandInput.value);
		commandInput.value = '';
	}

	_bindEvents () {
		const { document } = this;

		Object.assign(this._elements, {
			openDashboardButton: document.querySelector('#open-dashboard'),
			openSerialPortButton: document.querySelector('#connect-serialport'),
			serialPortPathInput: document.querySelector('input[type=text]'),
			commandInput: document.querySelector('#command'),
			commandSubmit: document.querySelector('button[type="submit"]'),
		});

		this._elements.openDashboardButton.addEventListener('click', this._openDashboard);
		this._elements.commandInput.form.addEventListener('submit', this._sendCommand);
	}

	_createTerminal () {
		const { document } = this;

		// List all available Serial Ports on system to choose from
		OBDParser.listAvailablePorts((ports) => ports.forEach((port) => this.logger.log(port)));

		this._elements.openSerialPortButton.addEventListener('click', () => {
			const { serialPortPathInput } = this._elements;

			this.logger.log(`opening serial port '${serialPortPathInput.value}'...`);

			this.obdParser = new OBDParser(
				serialPortPathInput.value,
				38400,
				() => {
					this.logger.log(`serial port '${serialPortPathInput.value}' open`);
					this._elements.openDashboardButton.disabled = false;
					this._elements.commandInput.disabled = false;
					this._elements.commandSubmit.disabled = false;
				},
				(error) => error && this.logger.log(error.toString())
			);

			this.obdParser.addMessageListener((data) => logger.log(data.toString()), OBDParser.MESSAGE_ALL);
		});
	}

	_windowOpenCallback () {
		this._addLogger();

		this._bindEvents();

		this._createTerminal();
	}
}

const app = new Application({
	viewFile: 'connector.html',
	width: 820,
	height: 635,
});
