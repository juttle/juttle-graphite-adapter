'use strict';

var _ = require('underscore');
var AdapterRead = JuttleAdapterAPI.AdapterRead;
var graphite = require('./graphite');
var JuttleMoment = JuttleAdapterAPI.types.JuttleMoment;

class ReadGraphite extends AdapterRead {
    constructor(options, params) {
        super(options, params);
        var name = null;
        this._validateOptions(options);

        if (params.filter_ast) {
            var ast = params.filter_ast;
            if (ast.type === 'BinaryExpression' &&
                (ast.operator === '==' || ast.operator === '=~')) {
                var left = ast.left;
                var right = ast.right;
                if (left && right) {
                    if (left.name === 'name' && right.type === 'StringLiteral') {
                        name = right.value;
                    }
                }
            }
        }

        // when no name was set then the filter expression is either missing
        // or wrong
        if (!name) {
            throw Error('Error: filter expression must match: name="XXX"/name~"X.*"');
        }

        this.name = name;
        this.from = this.options.from || params.now;
        this.to = this.options.to || params.now;
    }

    _validateOptions(options) {
        if (!options.from && !options.to) {
            throw this.compileError('MISSING-TIME-RANGE');
        }
    }

    periodicLiveRead() {
        return true;
    }

    defaultTimeOptions() {
        return {
            from: this.from,
            to: this.to,
            lag: JuttleMoment.duration(5, 's')
        };
    }

    read(from, to, limit, state) {
        return graphite.get(this.name, from, to)
        .then((res) => {
            if (res.status > 200) {
                throw new Error('graphite server responded with ' +
                                res.status + ': ' + res.statusText);
            }
            return res.json();
        })
        .then((payload) => {
            var points = [];

            _.each(payload, (data) => {
                var name = data.target;
                _.each(data.datapoints, (value) => {
                    // always check the first element of the data point list
                    // since graphite likes to send back nulls
                    if (value[0] !== null && value[0] !== undefined) {
                        var point = {
                            name: name,
                            value: value[0],
                            time: value[1]
                        };
                        points.push(point);
                    }
                });
            });

            this.parseTime(points, this.timeField);

            return {
                points: points,
                readEnd: to
            };
        });
    }
}

module.exports = ReadGraphite;
