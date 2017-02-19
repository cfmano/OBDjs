'use strict';

const PIDModes = require('./pid-modes');
const PIDTable = require('./pid-table');


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

module.exports = PIDTableProcessList;
