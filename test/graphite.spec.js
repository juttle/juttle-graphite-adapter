var juttle_test_utils = require('juttle/test/runtime/specs/juttle-test-utils');
var check_juttle = juttle_test_utils.check_juttle;
var expect = require('chai').expect;
var graphite = require('../lib/index.js');
var retry = require('bluebird-retry');
var uuid = require('uuid');

var Juttle = require('juttle/lib/runtime').Juttle;

Juttle.adapters.register('graphite', graphite({
    carbon: {
        host: 'localhost',
        port: 2003
    },
    webapp: {
        host: 'localhost',
        port: 8080,
        username: 'guest',
        password: 'guest'
    }
}, Juttle));

describe('graphite-adapter API tests', function () {

    it('fails when provided an invalid filter exprssion', function() {
        return check_juttle({
            program: 'read graphite -from :5 minutes ago: badfield="metric.does.not.exist"'
        })
        .then(function() {
            throw Error('Previous statement should have failed');
        }).catch(function(err) {
            expect(err.message).to.equal('Error: filter expression must match: name="XXX"/name~"X.*"');
        });
    });

    it('reads no points initially', function() {
        return check_juttle({
            program: 'read graphite -from :5 minutes ago: name="metric.does.not.exist"'
        })
        .then(function(result) {
            expect(result.errors.length).equal(0);
            expect(result.sinks.table.length).equal(0);
        });
    });

    it('read without -from fails', function() {
        return check_juttle({
            program: 'read graphite name~"bananas"'
        })
        .then(function() {
            throw Error('Previous statement should have failed');
        }).catch(function(err) {
            expect(err.message).to.equal('Error: invalid read graphite required option -from.');
        });
    });

    it('read with -unknown fails', function() {
        return check_juttle({
            program: 'read graphite -unknown "bananas"'
        })
        .then(function() {
            throw Error('Previous statement should have failed');
        }).catch(function(err) {
            expect(err.message).to.equal('Error: unknown read graphite option unknown.');
        });
    });

    it('can write a metric and then read it back', function() {
        var uniqueness = uuid.v1().substring(0, 6);
        var now = new Date();
        // graphite can only store points with second precision
        now.setMilliseconds(0);
        now = now.toISOString();

        return check_juttle({
            program: 'emit -from :' + now + ': -limit 1 ' +
                '| put name="metric' + uniqueness + '", value = count() | write graphite'
        })
        .then(function(result) {
            expect(result.errors.length).equal(0);
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    // -:1s: becuase from is exclusive
                    program: 'read graphite -from :' + now + ':-:1s: name="metric' + uniqueness + '"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(1);
                    expect(result.sinks.table[0].time).equal(now);
                    expect(result.sinks.table[0].name).equal('metric' + uniqueness);
                    expect(result.sinks.table[0].value).equal(1);
                });
            }, { interval:1000, timeout: 5000});
        });
    });

    it('can write multiple metrics and then read them back', function() {
        var uniqueness = uuid.v1().substring(0, 6);
        var iterations = 1000;
        return check_juttle({
            program: 'emit -from :1 hour ago: -limit ' + iterations + ' ' +
                '| put name="metric' + uniqueness + '", value = count() ' +
                '| write graphite'
        })
        .then(function(result) {
            expect(result.errors.length).equal(0);
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    program: 'read graphite -from :2 hours ago: name="metric' + uniqueness + '"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(iterations);
                    for(var index = 0; index < iterations; index ++) {
                        expect(result.sinks.table[index].name).to.be.equal('metric' + uniqueness);
                        expect(result.sinks.table[index].value).to.be.equal(index+1);
                    }
                });
            }, { interval:1000, timeout: 5000});
        });
    });

    it('can use -from/-to to get at specific values', function() {
        var uniqueness = uuid.v1().substring(0, 6);
        return check_juttle({
            program: 'emit -from :24 hours ago: -limit 24 -every :1 hour:' +
                '| put name="metric' + uniqueness + '", value = count() ' +
                '| write graphite'
        })
        .then(function(result) {
            expect(result.errors.length).equal(0);
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    // 25 hours ago because time is moving and 24 hours ago
                    // from the moment we did the write is now 24 hours ago + a few seconds
                    program: 'read graphite -from :25 hours ago: name="metric' + uniqueness + '"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(24);
                });
            }, { interval:1000, timeout: 5000 });
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    program: 'read graphite -from :20 hours ago: name="metric' + uniqueness + '"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(19);
                });
            }, { interval:1000, timeout: 5000 });
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    program: 'read graphite -from :20 hours ago: -to :3 hours ago: name="metric' + uniqueness + '"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(17);
                });
            }, { interval:1000, timeout: 5000 });
        });
    });

    it('can write a fully qualified metric name and read it back using .*', function() {
        var uniqueness = uuid.v1().substring(0, 6);
        return check_juttle({
            program: 'emit -from :30 seconds ago: -limit 4 ' +
                '| ( put value = count(), name="metric' + uniqueness + '.region1.host${value}" ;' +
                '    put value = count(), name="metric' + uniqueness + '.region2.host${value}" )' +
                '| write graphite'
        })
        .then(function(result) {
            expect(result.errors.length).equal(0);
        })
        .then(function() {
            return retry(function() {
                return check_juttle({
                    program: 'read graphite -from :1 minute ago: ' +
                        'name~"metric' + uniqueness + '.region2.*"'
                })
                .then(function(result) {
                    expect(result.errors.length).equal(0);
                    expect(result.sinks.table.length).equal(4);
                    for (var index = 0; index < 4; index++) {
                        expect(result.sinks.table[index].name).to.be.equal('metric' + uniqueness + '.region2.host' + (index+1));
                        expect(result.sinks.table[index].value).to.be.equal(index+1);
                    }
                });
            }, { interval:1000, timeout: 5000 });
        });
    });
});
