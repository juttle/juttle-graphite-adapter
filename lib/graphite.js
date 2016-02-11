'use strict';

var buffer = require('buffer');
var JuttleMoment = require('juttle/lib/runtime/types').JuttleMoment;
var logger = require('juttle/lib/logger').getLogger('graphite');
var net = require('net');
var url = require('url');

var Promise = require('bluebird');

/* globals global */
global.Promise = Promise;
var fetch = require('isomorphic-fetch');

module.exports = {
    headers: {},
    config: {},

    init: function(config) {
        var auth = new buffer.Buffer(config.webapp.username + ':' +
                                     config.webapp.password).toString('base64');
        this.headers = {
            'Authorization': 'Basic ' + auth.toString('base64')
        };
        this.config = config;
    },

    get: function(name, from, to) {

        // must convert timestamps to seconds because thats what graphite accepts
        var fromSec = Math.round(new JuttleMoment(from).seconds());
        var toSec = Math.round(new JuttleMoment(to).seconds());

        var urlPath = url.format({
            protocol: 'http',
            hostname: this.config.webapp.host,
            port: this.config.webapp.port,
            pathname: '/render',
            query: {
                target: name,
                from: fromSec,
                until: toSec,
                format: 'json'
            }
        });

        logger.debug('fetching', urlPath);
        return fetch(urlPath, { headers: this.headers });
    },

    getSocket: function() {
        var socket = net.Socket();
        socket.connect(this.config.carbon.port, this.config.carbon.host);
        return socket;
    }
};
