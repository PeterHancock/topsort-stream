var topsort = require('../index');
var  through =require('through');
var from = require('from');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;

describe("Topsort can sort streams when", function() {
  it("is passed no input", function(done) {
    from([])
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder([], done));
  });

  it("is passed a single element with no dependencies", function(done) {
    var input = [createData(1)];
    from(input)
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder(input, done));
  });

  it("is passed many elements with no dependencies", function(done) {
    var a = createData(1);
    var b = createData(2);
    var input = [a, b];
    from(input)
        .pipe(topsort(nodeResolver))
        .pipe(assertAnyOrder(input, done));
  });

it("is passed 2 elements, 1 depending upon the other", function(done) {
    var a = createData(1);
    var b = createData(2, [1]);
    var input = [a, b];
    from(input)
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder(input, done));
  });

  it("is passed 2 elements, 1 depending upon the other", function(done) {
    var a = createData(1, [2]);
    var b = createData(2);
    var input = [a, b];
    from([a, b])
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder([b, a], done));
  });

    it("is passed many items with dependencies", function(done) {
        var a = createData(1, [2]);
        var b = createData(2, [3]);
        var c = createData(3);
        from([a, b, c])
            .pipe(topsort(nodeResolver))
            .pipe(assertOrder([c, b, a], done));
    });

  it("is passed many items with dependencies", function(done) {
    var a = createData(1, [2, 3]);
    var b = createData(2, [3]);
    var c = createData(3);
    from([a, b, c])
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder([c, b, a], done));
  });
});

describe("Sorted stream will emit 'topsort-error' event of type ''", function() {
    it("is passed objects that depend upon themselves", function(done) {
        var err = "ERROR";
        var nodeResolver = function (obj) {
            throw err;
        };
        var complete = _.after(2, done);
        from([createData(1)])
            .pipe(topsort(nodeResolver))
            .on('topsort-error:resolving-node', function (reason) {
                expect(reason).toEqual(err);
                complete();
            })
            .pipe(through(null, complete));
    });

});

describe("Sorted stream will emit 'topsort-error:nodes-unresolved' event when", function() {
    it("passed objects that depend upon themselves", function(done) {
        var a = createData(1, [1]);
        assertNodesUnresolved(
            from([a]).pipe(topsort(nodeResolver)),
            [1],
            done);
    });

    it("passed objects that depend upon each other", function(done) {
        var a = createData(1, [2]);
        var b = createData(2, [1]);
        assertNodesUnresolved(
            from([a, b]).pipe(topsort(nodeResolver)),
            [1, 2],
            done);
    });

    it("objects are not provided", function(done) {
        var a = createData(1, [2]);
        assertNodesUnresolved(
            from([a]).pipe(topsort(nodeResolver)),
            [1, 2],
            done);
        });
});

describe("Asnycronous node resolvers", function () {
    it(" that accept callbacks work as expected", function (done) {
        var a = createData(1, [2]);
        var b = createData(2);
        var nodeResolver = createAsyncNodeResolver(function (data) {
            return 2 - data.id;
        });
        from([a, b])
            .pipe(topsort(nodeResolver))
            .pipe(assertOrder([b, a], done));
    });
    it("that return promises work as expected", function (done) {
        var a = createData(1, [2]);
        var b = createData(2);
        var nodeResolver = createPromiseReturningNodeResolver(function (data) {
            return 2 - data.id;
        });
        from([a, b])
        .pipe(topsort(nodeResolver))
        .pipe(assertOrder([b, a], done));
    });
});


function nodeResolver(data) {
    return {
        id: data.id,
        deps: data.deps
    };
}

function createAsyncNodeResolver(delayResolver) {
    return function (data, cb) {
        setTimeout(function () {
            cb(null, {
                id: data.id,
                deps: data.deps
            });
        }, delayResolver(data));
    };
}

function createPromiseReturningNodeResolver(delayResolver) {
    return function (data) {
        return new Promise(function (resolve) {
            return resolve(delayResolver(data));
        }).then(function () {
            return {
                id: data.id,
                deps: data.deps
            };
        });
    };
}

function createData(id, deps) {
    return {id: id, deps: deps || [] };
}

function assertOrder(expected, done) {
    var actual = [];
    return through(function (data) {
        actual.push(data);
    }, function () {
        expect(actual).toEqual(expected);
        done();
    });
}

function assertAnyOrder(expected, done) {
    var actual = [];
    var idSorter = function (data) { return data.id; };
    return through(function (data) {
        actual.push(data);
    }, function () {
        expect(_.sortBy(actual, idSorter)).toEqual(_.sortBy(expected, idSorter));
        done();
    });
}

function assertNodesUnresolved(stream, expected, done) {
    var complete = _.after(2, done);
    return stream.on('topsort-error:unresolved-nodes',
        function (nodes) {
            expect(nodes.sort()).toEqual(expected.sort());
            complete();
        })
        .pipe(through(null, complete));
}
