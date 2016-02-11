'use strict';

var _ = require('underscore');
var AdapterRead = require('juttle/lib/runtime/adapter-read');
var graphite = require('./graphite');
var JuttleMoment = require('juttle/lib/runtime/types').JuttleMoment;

class ReadGraphite extends AdapterRead {
    constructor(options, params) {
        super(options, params);
        var name = null;

        if (params.filter_ast) {
            if (params.filter_ast.type === 'ExpressionFilterTerm') {
                var expression =  params.filter_ast.expression;
                if (expression.type === 'BinaryExpression' &&
                    (expression.operator === '==' || expression.operator === '=~')) {
                    var left = expression.left;
                    var right = expression.right;
                    if (left && right) {
                        if (left.name === 'name' && right.type === 'StringLiteral') {
                            name = right.value;
                        }
                    } }
            }
        }

        // when no name was set then the filter expression is either missing
        // or wrong
        if (!name) {
            throw Error('Error: filter expression must match: name="XXX"/name~"X.*"');
        }

        this.name = name;
    }

    periodicLiveRead() { 
        return true;
    }

    defaultTimeRange() {
        return {
            from: new JuttleMoment(0),
            to: new JuttleMoment(Infinity)
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
