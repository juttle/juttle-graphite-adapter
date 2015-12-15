# Juttle Graphite Adapter

[![Build Status](https://magnum.travis-ci.com/juttle/juttle-graphite-adapter.svg?token=y7186y8XHjB7CcxwUcoX)](https://magnum.travis-ci.com/juttle/juttle-graphite-adapter)

Juttle graphite adapter used to read and write metric data to an existing
graphite setup.


# Installation / Setup

Check out this repository and the juttle repository into a working directory.

Run `npm link` in each.

Make sure the following is in your environment:

`NODE_PATH=/usr/local/lib/node_modules`


# Configuration

Add the following to ~/.juttle/config.json:

    "juttle-graphite-adapter": {
        "carbon": {
            "host": "localhost",
            "port": 2003
        },  
        webapp: {
            host: 'localhost',
            port: 8080,
            username: '...',
            password: '...'
        } 
    }


# Data Model

Graphite stores metrics with:
    
    name - alpha numeric sequence defining a path to your metric that you should
           consider naming appropriately. See graphite documentation for more 
           details: http://graphite.wikidot.com/getting-your-data-into-graphite

    value - numerical value for the metric identified.

    timestamp - the timestamp associated with this metric as an integer of
                seconds since epoch.

With this adapter we will simply map data points contain the same fields
`name`,`value`, and `time` fields to a graphite metric. All other points missing
these will be simply not written and a warning will be issued.

When reading data out of graphite every metric will be converted into the same 
data point with the same `name`,`value`, and `time` fields.

# Writing 

Within **juttle** you can write your data out simply like so:

```
read ... | put .. | reduce .. | write graphite
```

The key thing is to make sure your data contains the fields `name`, `value` and
`time` and when constructing data from a data point that has multiple fields
make sure to pick a naming convention you can easily use to parse back out of
graphite later. More details on naming your metric found here:

    http://graphite.wikidot.com/getting-your-data-into-graphite

# Reading

Reading existing metrics is simple as:

```
read graphite name~'app1.*.response_ms' -from :1 week ago:
| reduce value=avg(value) by name
```

If you encoded something like the region or hostname into the metric name then
you can easily parse that name in juttle. Lets imagine your metric name looks
like `region.host.metric_name` then you can calculate the average value of the 
response time per host every 1 minute for the last 24 hours like so:

```
read graphite name~'*.response_ms' -from :24 hours ago:
| put host = String.split(name, '.')[1]
| reduce -every :1 minute: value=avg(value) by host
```

# Development

To run the built in tests we need a running graphite setup which you can easily
spin up if you have docker by using the setup.sh script under /scripts like so:

```
cd scripts
./setup.sh 
```

The script will pull the juttler/graphite image and spinup a docker container
with the name `graphite`. 

At this point you can simply run `npm test` to run the built in test through 
mocha.
