#topsort-stream ![Travis CI status](https://api.travis-ci.org/PeterHancock/topsort-stream.png)


Topological sort for streams

[![NPM](https://nodei.co/npm/topsort-stream.png)](https://nodei.co/npm/topsort-stream/)

## Example

``` javascript
var topsort = require('topsort-stream')

var dependencies = {
    c: ['b'],
    d: ['b', 'c']
}

var s = new require('stream').Readable({ objectMode: true })

s.pipe(topsort(function (data) {
     return {
         id: data,
         deps: dependencies[data] || []
     }
 }))
 .on('data', console.log.bind(console))

s.push('d')
s.push('c')
s.push('a')
s.push('b')
s.push(null)
```

Yields
```
a
b
c
d
```

*'a'* and *'b'* where written to the destination stream after being read as they had no dependencies; *'a'* first because it was read before *'b'*. *'c'* and *'d'*  depended on *'b'* and written after; *'d'* was written last becauese it dependend upon *'c'*.  

A *real world* example would be a `gulp` plugin that is passed a `nodeResolver` (see **methods**) that extracts the dependencies from metadata from the file content.  

## API


``` javascript
var topsort = require('topsort-stream')
```
### methods

#### `var t = topsort(function nodeResolver(data) { return { [id: Object,] [deps: Array] } })`
 * `nodeResolver` defines the dependency graph bit assigning identity and dependencies to data.


## events

`t` inherits all all events from `stream.Readable`.

#### `t.on('topsort-error:resolving-node', cb)`

The event fires when there is an error resolving a node.


#### `t.on('topsort-error:unresolved-nodes', cb)`

The event fires when the readable side of the stream is closed before all dependencies have been resolved.  The call back is fired with an array of the ids of dependant nodes.

## Install

```
npm install topsort-stream
```

## license
MIT
