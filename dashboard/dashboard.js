'use strict';

class Dashboard {
	constructor (logger, window) {
		this._elements = {};
		this._windowParams = window || {
			viewFile: 'dashboard/dashboard.html',
			width: 1180,
			height: 540,
		};

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

	open (closeCallback) {
		nw.Window.open(this._windowParams.viewFile, { focus: true }, (win) => {
			this.logger.log('dashboard window open');

			console.log(this._windowParams);

			win.width = this._windowParams.width;
			win.height = this._windowParams.height;

			this.document = win.window.document;

			this.document.addEventListener('DOMContentLoaded', () => {
				this._bindEvents();
				this.logger.log('dashboard ready');
			});

			this.close = this._close.bind(this, win, closeCallback);
			win.on('close', this.close);
		});
	}

	_close (win, closeCallback = function(){}) {
		this.logger.log('closing dashboard window');
		closeCallback();
		win.close(true);
	}
}

module.exports = Dashboard;
