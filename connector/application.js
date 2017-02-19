'use strict';

const Logger = require('../logger/logger');
const OBDParser = require('../OBD/obd-parser');
const PIDTable = require('../OBD/PID/pid-table');
const PIDModes = require('../OBD/PID/pid-modes');
const Dashboard = require('../dashboard/dashboard');


class Application {
	constructor () {
		this._windowParams = {
			viewFile: 'connector/connector.html',
			width: 820,
			height: 635,
		};
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


	_sendCommand (event) {
		event.preventDefault();

		const { commandInput } = this._elements;

		console.log(`sending manual command '${commandInput.value}'`);
		this.obdParser.sendCommand(commandInput.value);
		commandInput.value = '';
	}


	_addDashboardBindings () {
		this.obdParser.addMessageListener(this._dashboard.updateRpm, PIDModes.RT.read, PIDTable.RPM);
		this.obdParser.addMessageListener(this._dashboard.updateSpeed, PIDModes.RT.read, PIDTable.SPEED);

		this._dashObserver = this.obdParser.addObserver(PIDModes.RT, [ PIDTable.RPM, PIDTable.SPEED ]);
	}

	_removeDashboardBindings () {
		this.obdParser.removeObserver(this._dashObserver);

		this.obdParser.removeMessageListener(this._dashboard.updateRpm, PIDModes.RT.read, PIDTable.RPM);
		this.obdParser.removeMessageListener(this._dashboard.updateSpeed, PIDModes.RT.read, PIDTable.SPEED);
	}

	_closeDashboard () {
		this._removeDashboardBindings();
		this._dashboard.close();
	}

	_openDashboard () {
		this._elements.openDashboardButton.disabled = true;

		this.logger.log('opening dashboard...');

		if (this._dashboard) {
			this._closeDashboard();
		}

		this._dashboard = new Dashboard(this.logger);

		this._dashboard.open(() => {
			this._elements.openDashboardButton.disabled = false;
			this._removeDashboardBindings();
		});

		this._addDashboardBindings();
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

		this._elements.openDashboardButton.addEventListener('click', this._openDashboard.bind(this));
		this._elements.commandInput.form.addEventListener('submit', this._sendCommand.bind(this));
	}


	_createTerminal () {
		const { document } = this;

		// List all available Serial Ports on system to choose from
		OBDParser.listAvailablePorts((ports) => ports.forEach((port) => this.logger.log(port)));

		this._elements.openSerialPortButton.addEventListener('click', () => {
			const { serialPortPathInput, openSerialPortButton } = this._elements;

			openSerialPortButton.disabled = true;

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
				(error) => {
					if (error) {
						this._elements.openSerialPortButton.disabled = false;
						this.logger.log(error.toString());
					}
				}
			);

			this.obdParser.addMessageListener((data) => this.logger.log(data.toString()), OBDParser.MESSAGE_ALL);
		});
	}


	_windowOpenCallback () {
		this._addLogger();

		this._bindEvents();

		this._createTerminal();
	}
}

module.exports = Application;
