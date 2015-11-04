"use strict";

/**
 * Runs the mobile portal HTTP server as a cluster containing of so many nodes as processor cores available.
 */
var
	cluster = require('cluster'),
	log     = require('x-log');

// note: the master log file has always suffix 0. Set suffix asap to prevent messages in files without suffix
if ( cluster.isMaster ){
	log.file.suffix ='0';
	log.info && log.info('master sets log file suffix to:' + log.file.suffix ); // note new file and name is generated in this line, therefore second log line required, to get correct file name property value
	log.info && log.info('master is now logging in:' + log.file.name ); 
} else {
	log.file.suffix = cluster.worker.id;
	log.info && log.info('worker ' + cluster.worker.id + ' sets log file suffix to:' + log.file.suffix );  // note new file and name is generated in this line, therefore second log line required, to get correct file name property value
	log.info && log.info('worker ' + cluster.worker.id + ' is now logging in:'+ log.file.name );
}

var
	path    = require('path'),
	fs      = require('fs');

var CPU_CORES          = require('os').cpus().length,
	MAX_STARTUP_DEATHS = 20,
	STARTUP_TIME       = new Date();

function Clusterize( start_master, start_server, options) {
	
	this.count = options.count || CPU_CORES;
	this.pid_file = options.pid_file === false ? false : options.pid_file || 'cluster.pid';
	this.deaths  = 0;
	this.online  = 0;
	this.workers = cluster.workers;
	
	//this.slots = [];
	//this.slots.length = this.worker_count;
	
	/**
	 * Cluster Start: starts the master and forks worker threads.
	 */
	this.start = function (){
		if (cluster.isMaster){
			
			this.remove_pid_file();
			
			log.info && log.info('starting with ' + this.count + ' workers.');
			
			cluster.on('online', function(worker){
				// NOTE a worker can exist and be killed before it is online, online means it is ready to receive IO via node libuv
				this.online++;
				log.info && log.info('worker '+ worker.id + ' is online.' );
			});
			
			this.fork(this.count,0);
			
			var _ = this;
			
			['SIGINT', 'SIGQUIT', 'SIGKILL', 'SIGABRT', 'SIGTERM', 'SIGSTOP', 'SIGTSTP', 'SIGCONT', 'SIGHUP'].forEach(function (signal) {
				process.on(signal, function (s) {
					log.info && log.info('master received signal:' + signal);
					_.stop();
				});
			});
			
			cluster.on('exit' , _._on_worker_exit.bind(_) ); // node 0.8
			
			this.write_pid_file();
			
			if (start_master) start_master();
		}
		else {
			start_server();
		}
	};
	/**
	 * Cluster Stop: destroys all workers, removes pid file
	 * @param exit exit code or boolean false to prevent exit
	 */
	this.stop = function (exit) {
		
		if (void 0 === exit) exit = 0;
		
		// kill all workers first, and then the master
		for( var id in cluster.workers){
			log.info && log.info('destroy worker ' + id );
			try {
				cluster.workers[id].destroy();
			} catch (e){
				log.error && log.error('could not destroy worker.',e);
			}
		}
		
		this.remove_pid_file();
		
		if( exit !== false ){
			
			log.info && log.info('exit(' + exit + ')');
			
			try {
				process.exit(exit);
			} catch (e){
				log.error && log.error('could not exit.',e);
			}
		}
	};
	
	/**
	 * Creates a specified count worker threads in free slots
	 */
	this.fork = function (count ) {
		for (var i = 0; i < count; i++) {
			
			var fork = cluster.fork();
			var proc = fork.process || fork;  // move from node 0.6 to 0.8
			
			log.info && log.info('worker forked, pid:' + proc.pid );
		}
	};
	
	/**
	 * Callback function called, when a worker thread died. Starts a new worker thread. 
	 */
	this._on_worker_exit = function (worker) {
		
		if(!worker.suicide){
			
			this.online--;
			this.deaths++;
			
			log.error && log.error('worker '+ worker.id +' died, pid:' + worker.process.pid);
			
			if (new Date() - STARTUP_TIME < 20000 && this.deaths == MAX_STARTUP_DEATHS ){
				
				log.error && log.error('over ' + MAX_STARTUP_DEATHS + ' worker deaths during startup. There is something seriously wrong with your server. Aborting.');
				
				return this.stop(1);
			}
			
			this.fork(1); // try to replace the dead worker with another, should use the new free slot
		}
	};
	
	this.write_pid_file = function () {
		if (this.pid_file){
			
			var pids = '' + process.pid + '\n';
			
			fs.writeFileSync(this.pid_file, pids, 'ascii');
		}
	};
	
	this.remove_pid_file = function () {
		var f = this.pid_file;
		
		if (f && fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) { log.error && log.error('remove \"' + f + '\" failed', e); }
		
		log.info && log.info("removed pid file");
	};
}

module.exports = Clusterize;
