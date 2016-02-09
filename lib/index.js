'use strict';

var graphite = require('./graphite');

function GraphiteAdapter(config) {
    graphite.init(config);

    return {
        name: 'graphite',
        read: require('./read'),
        write: require('./write')
    };
}

module.exports = GraphiteAdapter;
