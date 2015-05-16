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

describe("Sorted stream with emit dependency-error when", function() {
    it("is passed elements that depend upon themselves", function(done) {
        var a = createData(1, [1]);
        assertNonDag(from([a])
            .pipe(topsort(nodeResolver)), [1], done);
    });

    it("is passed elements that depend upon each other", function(done) {
        var a = createData(1, [2]);
        var b = createData(2, [1]);
        assertNonDag(from([a, b])
            .pipe(topsort(nodeResolver)), [1, 2], done);
    });

    it("elements are not resolved", function(done) {
        var a = createData(1, [2]);
        assertNonDag(from([a])
            .pipe(topsort(nodeResolver)), [1, 2], done);
        });
});

describe("Asnycronous node resolvers", function () {
    it(" that accept callbacks work as expected", function done(done) {
        var a = createData(1, [2]);
        var b = createData(2);
        var nodeResolver = createAsyncNodeResolver(function (data) {
            return 2 - data.id;
        });
        from([a, b])
            .pipe(topsort(nodeResolver))
            .pipe(assertOrder([b, a], done));
    });
    it("that return promises work as expected", function done(done) {
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
            }
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

function assertNonDag(stream, expected, done) {
    var complete = _.after(2, done);
    return stream.on('dependency-error',
        function (list) {
            expect(list.sort()).toEqual(expected.sort());
            complete();
        })
        .pipe(through(null, complete));
}
