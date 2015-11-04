

<!-- Start clusterize.js -->

## cluster

Runs the mobile portal HTTP server as a cluster containing of so many nodes as processor cores available.

## start()

Cluster Start: starts the master and forks worker threads.

## stop(exit)

Cluster Stop: destroys all workers, removes pid file

### Params:

* *exit* exit code or boolean false to prevent exit

## fork()

Creates a specified count worker threads in free slots

## _on_worker_exit()

Callback function called, when a worker thread died. Starts a new worker thread.

<!-- End clusterize.js -->

