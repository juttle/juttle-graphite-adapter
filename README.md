# Juttle Graphite Adapter

[![Build Status](https://travis-ci.org/juttle/juttle-graphite-adapter.svg?branch=master)](https://travis-ci.org/juttle/juttle-graphite-adapter)

Graphite adapter for the [Juttle data flow
language](https://github.com/juttle/juttle), with read & write support.

## Examples

Reading existing metrics is as simple as:

```juttle
read graphite -from :1 week ago: name ~ 'app1.*.response_ms'
| reduce value = avg(value) by name
```

This will compute last week's average of every metric matching `app1.*.response_ms`.

If you encoded something like the region or hostname into the metric name then
you can easily parse that name in juttle. Let's say your metric name looks
like `region.host.metric_name`. Then you can calculate the average value of the
response time per host every 1 minute for the last 24 hours like so:

```juttle
read graphite -from :24 hours ago: name ~ '*.response_ms'
| put host = String.split(name, '.')[1]
| reduce -every :1 minute: value = avg(value) by host
```

## Installation

Like Juttle itself, the adapter is installed as a npm package. Both Juttle and
the adapter need to be installed side-by-side:

```bash
$ npm install juttle
$ npm install juttle-graphite-adapter
```

## Configuration

The adapter needs to be registered and configured so that it can be used from
within Juttle. To do so, add the following to your `~/.juttle/config.json` file:

```json
{
    "adapters": {
        "graphite": {
            "carbon": {
                "host": "localhost",
                "port": 2003
            },
            "webapp": {
                "host": "localhost",
                "port": 8080,
                "username": "...",
                "password": "..."
            }
        }
    }
}
```

Keys in `carbon` specify the location of Graphite storage backend, keys in
`webapp` contain configuration for the Graphite frontend.

## Usage

### Data Model

Graphite stores metrics with:

- `name` - alphanumeric sequence defining a path to your metric that you should
consider naming appropriately. See [graphite documentation](http://graphite.wikidot.com/getting-your-data-into-graphite)
for more details.

- `value` - numerical value for the metric identified

- `timestamp` - the timestamp associated with this metric as an integer of
seconds since epoch.

### Read options

When reading data out of graphite every metric will be converted into
a point with the `name`, `value`, and `time` fields.

Name | Type | Required | Description
-----|------|----------|-------------
`from` | moment | no | select points after this time (inclusive)
`to`   | moment | no | select points before this time (exclusive)

### Write options

This adapter maps data points containing the fields `name`, `value`, and
`time` to a graphite metric. All other points missing these fields are not
written and a warning is issued instead.

So, for writing, the key thing is to make sure your data contains the fields
`name`, `value` and `time`. When constructing data from a data point that
has multiple fields, make sure to pick a naming convention you can easily use
to parse back out of graphite later. More details on naming your metric can be found
in the [graphite wiki](http://graphite.wikidot.com/getting-your-data-into-graphite).

## Contributing

Want to contribute? Awesome! Don’t hesitate to file an issue or open a pull
request.
