'use strict';

class Dashboard {
	constructor (window, logger) {
		this._elements = {};
		this._windowParams = window;

		this.logger = logger;
	}

	_bindEvents () {
		Object.assign(this._elements, {
			revMeter: this.document.querySelector('#revmeter .gauge'),
			speedMeter: this.document.querySelector('#speedmeter .gauge'),
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

module.exports = Dashboard;
