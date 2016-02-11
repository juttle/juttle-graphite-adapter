'use strict';

var _ = require('underscore');
var AdapterWrite = require('juttle/lib/runtime/adapter-write');
var graphite = require('./graphite');

class WriteGraphite extends AdapterWrite {

    constructor(options, params) {
        super(options, params);
        this.socket = graphite.getSocket();

        this.socketDone = new Promise((resolve, reject) => {
            this.socket.on('end', () => {
                resolve();
            });
            this.socket.on('error', (err) => {
                reject(err);
            });
        });
    }

    write(points) {
        var payload = [];

        _.each(points, (point) => {
            var timestamp = Math.round(new Date(point.time).getTime()/1000);

            if (point.name) {
                if (typeof point.value === 'number' && point.value === point.value) {
                    payload.push(point.name + ' ' + point.value + ' ' + timestamp + '\n');
                } else {
                    this.trigger('warning', new Error('required field "value" not found in data'));
                }
            } else {
                this.trigger('warning', new Error('required field "name" not found in data'));
            }
        });

        this.socket.write(payload.join(''), 'utf-8', (err) => {
            if (err) {
                this.trigger('error', err);
                this.done();
            }
        });
    }

    eof() {
        this.socket.end();
        return this.socketDone;
    }
}

module.exports = WriteGraphite;
