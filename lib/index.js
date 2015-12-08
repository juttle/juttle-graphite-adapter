function GraphiteBackend(config) {
    return {
        name: 'graphite',
        read: require('./read')(config),
        write: require('./write')(config)
    };
}

module.exports = GraphiteBackend;
