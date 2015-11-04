"use strict";

// note you have to set this no log level BEFORE require clusterize, otherwise clusterize will produce log messages.
var log = require('x-log');
log.levels.no = log.levels.error+1;
log.level="no";
// log.level="debug" // uncomment this if you want to see more logging

//---------
var
	clusterize = require('../clusterize'),
	cluster    = require('cluster'),
	assert     = require('assert'),
	express    = require('express'),
	vows       = require('vows');

var port=19991;

var create_cluster=function(count){
	
	var clstr = new clusterize(
		function(){
				if(log.info)log.info('master:'+process.pid);
				for(var id in cluster.workers ){ // each worker an own monitor
					cluster.workers[id].send({msg:'test msg'});
				}
				clstr.__deathCount=0;
				cluster.on('exit', function() {
					 log.info && log.info('death event received');
					 clstr.__deathCount++;
				});
		},
		function(){
				if(log.info)log.info('worker:'+process.pid);
				// upon request by parent process start an own monitor with stats
				process.on('message',function(m) {
					log.info && log.info('received_message',m);
				});
				
				//var s=express.createServer();
				var s = express();
				s.use(s.router);
				s.use(express.errorHandler());
				s.get('/ping', function(req,res){ res.send(200);});
				s.get('/exit', function(req,res){ res.send(200);s.close();process.exit(0);});
				s.listen(port);
				log.info && log.info("listen on "+port);
		},
		{count:count}
	);
	clstr.start();
	return clstr;
};

function kill(pid,cb/*callback(exit code)*/){
	var spawn = require('child_process').spawn;
	
	log.info && log.info('try kill '+pid);
	
	var killer = spawn('kill', [pid]);
	
	killer.stdout.on('data', function (data) {
		log.info && log.info('kill stdout:'+data);
	});
	
	killer.stderr.on('data', function (data) {
		log.info && log.info('kill stderr:'+data);
	});
	
	killer.on('exit', function (code) {
		log.info && log.info('kill process exited with code:' + code);
		cb(code);
	});
}

function test_count( count, cb ){
	var checks=0;
	(function F(){
		checks++;
		var pids=[]; for(var id in cluster.workers) pids.push(cluster.workers[id].process.pid);
		if( pids.length === count ){
			cb(true,pids);
		} else if( 3 === checks ){
			cb(false,pids);
		} else {
			setTimeout(F,2000);
		}
	})();
}

function test_online( clstr, online, cb ){
	var checks=0;
	(function F(){
		checks++;
		if( clstr.online === online ){
			cb( true, clstr.online );
		} else if( 3 === checks ){
			cb( false, clstr.online );
		} else {
			setTimeout( F, 2000 );
		}
	})();
}

function test_deaths( clstr, deaths, cb ){
	var checks=0;
	(function F(){
		checks++;
		if( clstr.deaths === deaths ){
			cb( true, clstr.deaths );
		} else if( 3 === checks ){
			cb( false, clstr.deaths );
		} else {
			setTimeout( F, 2000 );
		}
	})();
}


if(cluster.isMaster){
	var suite = vows.describe('master');
	suite.addBatch({
		"two workers": {
			topic: function(){
				return create_cluster(2);
			},
			"await 2 worker created": {
				topic: function(clstr) {
					var self=this;
					test_count(2,function(result,pids){
						self.callback(clstr,pids);
					});
				},
				"2 workers created": function(clstr,pids){
					assert.equal(2,pids.length);
				},
				"await 2 workers online": { 
					topic: function(clstr, pids){
						var self=this;
						test_online( clstr, 2, function(result, online ){
							self.callback( clstr, pids, online );
						});
					},
					"2 workers became online ": function( clstr, pids, online ){
						assert(2,online);
					},
					"kill first worker check restart" : {
						topic: function(clstr, pids) {
							var
								self          = this,
								first_pid     = pids[0],
								deaths_before = clstr.deaths;
							
							log.info && log.info('try kill '+first_pid);
							
							kill( first_pid, function(code) {
								log.info && log.info('kill '+first_pid+' exited with code:' + code);
								self.callback(clstr, code, deaths_before );
							});
						},
						"check kill call ok": function(clstr, code){
							assert.equal(code,0);
						},
						"await new death count": {
							topic: function(clstr,code,deaths_before){
								var self=this;
								test_deaths( clstr, deaths_before+1, function(result, deaths_after){
									self.callback( clstr, deaths_before, deaths_after );
								});
							},
							"death count increased":function( clstr, deaths_before, deaths_after ){
								assert.equal(deaths_after,deaths_before+1);
							},
							"await and check worker count 2 after death count increased": function(clstr){
								test_count(2,function(result){ assert(result);});
							}
						}
					}
				}
			},
			teardown:function(clstr){
				clstr.stop(false);
				test_count(0,function(ok,pids){ 
					if(!ok) log.error && log.error("could not stop all workers.",{pids:pids});
				});
			}
		}
	}).exportTo(module,{error:false});
} else {
	// this is a dummy test, needed for the vows RUNNER (so if you call it with bin/vows
	// note clusterize will fork a new vows runner process!!
	// the only important thing here is that create_cluster is called and the process doesn't end.
	// As the vows runner will exit after all tests are done, we add here an artificial setTimeout delay. 
	// As a result this worker process should keep running, until the master says destroy or a test issues a kill to the pid of this process
	// note the *master* will kill a process during its tests
	var suite = vows.describe('worker');
	suite.addBatch({
		"worker" : {
			topic: function(){
				var self=this, clstr = create_cluster(2);
				setTimeout(function(){
					// NOTE: it should never finish, becaus the
					// master test will destroy the workers in teardown.
					self.callback(clstr);
				},20000);
			},
			"timeout does never occur" : function(clstr){
				assert(false);
			}
		}
	});
	suite.exportTo(module,{error:false});
}
