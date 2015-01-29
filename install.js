'use strict';

exports.name = 'serve';
exports.usage = '<names> [options]';
exports.desc = 'Start a small static resource server';

var path = require('path');

exports.register = function(commander,quick){

    commander
        .option('-r, --root <path>', 'set serve root')
        .option('-p, --port <n>', 'Set the listening port')
        .action(function(){

            var Promise = quick.util.Promise;

            var args = [].slice.call(arguments);
            var options = args.pop();

            var settings = {
                root: options.root || '',
                port: options.port || 3000
            };

            Promise.try(function() {
                return quick.util.findConf(function(dir){
                    var filepath =  path.resolve(dir, 'qconf.js');
                    settings = quick.util.merge(require(filepath),settings);
                });
            }).then(function(){
                var serve = require('./lib/serve')(quick,settings);
                var server = serve.server;
                server.listen(settings.port,function(err){
                    if(!err){
                        quick.log.success('file server started，listening on port '+settings.port);
                    }else{
                        quick.log.error('file service failed to start!')
                    }
                });
                server.on('error',function(e) {
                    if (e.code == 'EADDRINUSE') {
                        quick.log.error('Address in use, Please change the port，file service failed to start! ');
                    } else {
                        quick.log.error('file service failed to start! Error Code：'+ e.code);
                    }
                });

            }).catch(function(e) {
                quick.log.error('\x1b[31m%s\x1b[0m', e.message);
            });
        });
};