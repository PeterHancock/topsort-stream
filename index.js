var through = require('through');
var _ = require('lodash');
var Promise = require('es6-promise').Promise;
var denodeify = require('es6-denodeify')(Promise);

/**
    nodeResolver maps Objects read from a stream to Node Objects

    Node has properties
    id: Any (required)
    deps: Array[id] (optional)
*/
var topsort = function (nodeResolver) {
    var nodes = new Nodes(nodeResolver);
    var pending = {};
    var nodeCount = 0;
    var stream = through (
        function (data) {
            var count = nodeCount;
            nodeCount = nodeCount + 1;
            pending[count] = nodes.handleNode(data)
                .then(function (resolved) {
                    delete pending[count];
                    resolved.forEach(stream.queue, stream);
                }).catch(function (reason) {
                    stream.emit('dependency-error', reason);
                });
        },
        function() {
            Promise.all(_.values(pending)).then(function() {
                nodes.end(stream);
                stream.queue(null);
            });
        }
    );
    return stream;
};

function Nodes (nodeResolver) {
    this.nodes = {};
    if (nodeResolver.length > 1) {
        this.nodeResolver = denodeify(nodeResolver);
    } else {
        this.nodeResolver = function (data) {
            return new Promise(function (resolve) {
                return resolve(nodeResolver(data));
            });
        };
    }
}

Nodes.prototype = {
    handleNode: function (data) {
        var scope = this;
        return this.nodeResolver(data)
            .then(function (nodeInfo) {
                var node = scope.registerNode(nodeInfo, data);
                return scope.getResolvedNodes(node).map(function (node) {
                    return node.data;
                });
            });
    },

    registerNode: function (nodeInfo, data) {
        var node = this.getNode(nodeInfo.id);
        node.data = data;
        node.dependencies = nodeInfo.deps.map(this.getNode, this) || [];
        node.dependencies.forEach(function (dep) {
            if (!dep.resolved) {
                dep.dependants.push(node);
            }
        });
        return node;
    },

    getResolvedNodes: function (node) {
        var dependencies = node.dependencies;
        var resolvedNodes = [];
        var canResolve = _(node.dependencies).every(function (dep) {
            return dep.resolved;
        });
        if (canResolve) {
            node.resolved = true;
            resolvedNodes.push(node);
            var dependants = node.dependants;
            this.deregisterNode(node);
            dependants.forEach(function (dependant) {
                resolvedNodes.push.apply(resolvedNodes, this.getResolvedNodes(dependant));
            }, this);
        }
        return resolvedNodes;
    },

    getNode: function (id) {
        return (this.nodes[id] = this.nodes[id] || { id: id, dependants: [] });
    },

    deregisterNode: function (node) {
        delete node.dependencies;
        delete node.dependants;
    },

    end: function (stream) {
        var nodesNotResolved = _.filter(this.nodes, function (node) {
            return !node.resolved;
        });

        if (nodesNotResolved.length > 0) {
            stream.emit('dependency-error', _.pluck(nodesNotResolved, 'id'));
        }
    }
};

module.exports = topsort;
