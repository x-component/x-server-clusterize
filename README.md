# x-server-clusterize

[Build Status](https://travis-ci.org/x-component/x-server-clusterize.png?v0.0.1)](https://travis-ci.org/x-component/x-server-clusterize)

- [./clusterize.js](#clusterizejs) 

# ./clusterize.js

  - [cluster](#cluster)
  - [this.start()](#thisstart)
  - [this.stop()](#thisstopexit)
  - [this.fork()](#thisfork)
  - [this._on_worker_exit()](#this_on_worker_exit)

## cluster

  Runs the mobile portal HTTP server as a cluster containing of so many nodes as processor cores available.

## this.start()

  Cluster Start: starts the master and forks worker threads.

## this.stop(exit:)

  Cluster Stop: destroys all workers, removes pid file

## this.fork()

  Creates a specified count worker threads in free slots

## this._on_worker_exit()

  Callback function called, when a worker thread died. Starts a new worker thread.
