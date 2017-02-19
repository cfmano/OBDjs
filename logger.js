'use strict';

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

module.exports = Logger;
