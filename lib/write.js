var _ = require('underscore');
var buffer = require('buffer');
var JuttleMoment = require('juttle/lib/moment').JuttleMoment;
var net = require('net');
var Promise = require('bluebird');
var url = require('url');
var Juttle = require('juttle/lib/runtime').Juttle;

/* globals global */
global.Promise = Promise;
var fetch = require('isomorphic-fetch');

var Write = function(config) {
    return Juttle.proc.sink.extend({
        procName: 'writex-graphite',

        initialize: function(options, params) {
            // XXX: missing checks for all required config values
            this.name = 'writex-graphite';
            var self = this;

            this.socket = net.Socket();
            this.socket.connect(config.carbon.port, config.carbon.host);

            this.socket.on('end', function() {
                // only eof when we've closed the socket
                self.on_eof(self);
            });

            this.isDone = new Promise(function(resolve, reject) {
                self.on_eof = resolve;
            });
        },

        process: function(points) {
            var self = this;
            var payload = [];

            _.each(points, function(point) {
                var timestamp = Math.round(new Date(point.time).getTime()/1000);

                if (point.name) {
                    if (typeof point.value === 'number' && point.value === point.value) {
                        payload.push(point.name + ' ' + point.value + ' ' + timestamp + '\n');
                    } else {
                        this.trigger('warning', this.runtime_error('RT-FIELD-NOT-FOUND', {
                            field: 'value'
                        }));
                    }
                } else {
                    this.trigger('warning', this.runtime_error('RT-FIELD-NOT-FOUND', {
                        field: 'name'
                    }));
                }
            });

            self.socket.write(payload.join(''), 'utf-8', function(err) {
                if (err) {
                    self.trigger('error', err);
                    this.done();
                }
            });
        },

        eof: function() {
            this.socket.end();
            this.done();
        },

    });
};

module.exports = Write;
