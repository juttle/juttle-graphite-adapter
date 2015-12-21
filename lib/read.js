var _ = require('underscore');
var buffer = require('buffer');
var JuttleMoment = require('juttle/lib/moment').JuttleMoment;
var net = require('net');
/* global -Promise */
var Promise = require('bluebird');
var url = require('url');
var Juttle = require('juttle/lib/runtime').Juttle;

/* globals global */
global.Promise = Promise;
var fetch = require('isomorphic-fetch');

var Read = function(config) {
    return Juttle.proc.source.extend({
        sourceType: 'batch',
        procName: 'read-graphite',

        initialize: function(options, params, pname, location, program, juttle) {
            var allowed_options = ['from', 'to'];
            var unknown = _.difference(_.keys(options), allowed_options);
            if (unknown.length > 0) {
                throw this.compile_error('RT-UNKNOWN-OPTION-ERROR', {
                    proc: 'read graphite',
                    option: unknown[0]
                });
            }

            this.from = options.from;
            this.to = options.to;

            if (!this.from) {
                throw this.compile_error('RT-REQUIRED-OPTION-ERROR', {
                    proc: 'read graphite',
                    option: '-from'
                });
            }

            var from = Math.round(new JuttleMoment(this.from).milliseconds()/1000);
            var to;

            if (this.to) {
                to = Math.round(new JuttleMoment(this.to).milliseconds()/1000);
            }

            var auth = new buffer.Buffer(config.webapp.username + ':' + config.webapp.password).toString('base64');
            this.headers = {
                'Authorization': 'Basic ' + auth.toString('base64')
            };

            this.filter = null;
            var name = null;
            if (params.filter_ast) {
                var compiler = new Juttle.FilterJSCompiler();
                var source = compiler.compile(params.filter_ast);

                var expression =  params.filter_ast.expression;
                if (expression.type === 'BinaryExpression' &&
                    (expression.operator === '==' || expression.operator === '=~')) {
                    var left = expression.left;
                    var right = expression.right;
                    if (left && right) {
                        if (left.value === 'name' && right.type === 'StringLiteral') {
                            name = right.value;
                        }
                    }
                }

                if (name) {
                    /* jshint evil: true */
                    this.filter = eval(source);
                }
            }

            // when no name was set then the filter expression is either missing
            // or wrong
            if (!name) {
                throw Error('Error: filter expression must match: name="XXX"/name~"X.*"');
            }

            this.url = url.format({
                protocol: 'http',
                hostname: config.webapp.host,
                port: config.webapp.port,
                pathname: '/render',
                query: {
                    target: name,
                    from: from,
                    until: to,
                    format: 'json'
                }
            });
        },

        start: function() {
            var self = this;

            return fetch(this.url, { headers: self.headers })
            .then(function(res) {
                if (res.status > 200) {
                    throw self.runtime_error('RT-INTERNAL-ERROR', {
                        error: res.status + ': ' + res.statusText
                    });
                }
                return res.json();
            })
            .then(function(payload) {
                _.each(payload, function(data) {
                    var points = [];
                    var name = data.target;
                    _.each(data.datapoints, function(value){
                        // always check the first element of the data point list
                        // since graphite likes to send back nulls
                        if (value[0]) {
                            var time = new JuttleMoment();
                            time.parseDate(value[1]);

                            var point = {
                                name: name,
                                value: value[0],
                                time: time
                            };
                            points.push(point);
                        }
                    });

                    if (self.filter !== null) {
                        points = points.filter(self.filter);
                    }


                    if (points.length !== 0 ) {
                        self.emit(points);
                    }
                });
                self.emit_eof();
            })
            .catch(function(err) {
                self.trigger('error', self.runtime_error('RT-INTERNAL-ERROR', { error: err.toString() }));
                self.emit_eof();
            });
        }
    });
};

module.exports = Read;
