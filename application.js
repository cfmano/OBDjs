'use strict';

const Logger = require('./logger');
const OBDParser = require('./obd-parser');
const Dashboard = require('./dashboard');


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

module.exports = Application;
