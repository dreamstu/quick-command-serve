/**
 * Created by johnkim on 15-1-20.
 */
var path = require('path');
var fs = require('fs');
var http = require('http');
var url = require('url');

//默认配置
var confs = {
    mine : {//mine类型
        "css": "text/css",
        "gif": "image/gif",
        "html": "text/html",
        "ico": "image/x-icon",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "js": "text/javascript",
        "json": "application/json",
        "pdf": "application/pdf",
        "png": "image/png",
        "svg": "image/svg+xml",
        "swf": "application/x-shockwave-flash",
        "tiff": "image/tiff",
        "txt": "text/plain",
        "wav": "audio/x-wav",
        "wma": "audio/x-ms-wma",
        "wmv": "video/x-ms-wmv",
        "xml": "text/xml"
    },
    expires : {//过期时间
        fileMatch: /^(gif|png|jpg|js|css)$/ig,
        maxAge: 60 * 60 * 24 * 365
    },
    rules : function(pathname,ext){//执行wrap条件，用户可覆盖此默认配置
        return pathname.indexOf('static/page')!=-1 && ext=='js';
    },
    transfer : {//转换器，用户可覆盖或修改默认配置
        js:function(content){
            return [
                'define(function(require, exports, module) {\n',
                content,
                '\n});'
            ].join('');
        }
    }
};


module.exports = initServer = function(quick){
    var exports = {};

    confs = quick.util.merge(quick.config.serve || {},confs);
    var $mine = confs.mine;
    var $expires = confs.expires;
    var $rules = confs.rules;
    var $transfer = confs.transfer;
    var $basePath = (quick.config.serve.root_temp!=''?
        quick.config.serve.root_temp:
        (quick.util._.has(confs,'root')?
            confs.root:
            process.cwd()));
    quick.log.ok('用户设定监听路径为：\n'+$basePath);

    exports.server = http.createServer(function (request, response) {
        var pathname = url.parse(request.url).pathname;
        if(pathname=='/'){
            response.write("hello quick serve.");
            response.end();
        }

        var realPath = path.join($basePath, pathname);
        fs.exists(realPath, function (exists) {
            if (!exists) {
                response.writeHead(404, {
                    'Content-Type': 'text/plain'
                });
                quick.log.error('404 failure to request file:\t'+request.url);
                response.write("This request URL " + pathname + " was not found on this server.");
                response.end();
            } else {
                //文件的最后修改时间
                fs.stat(realPath, function (err, stat) {
                    var lastModified = stat.mtime.toUTCString();
                    response.setHeader("Last-Modified", lastModified);
                    if (request.headers['ifModifiedSince'] && lastModified == request.headers['ifModifiedSince']) {
                        quick.log.ok('304 requested file:\t'+request.url);
                        response.writeHead(304, "Not Modified");
                        response.end();
                    }
                });
                fs.readFile(realPath, "binary", function (err, file) {
                    if (err) {
                        response.writeHead(500, {
                            'Content-Type': 'text/plain'
                        });
                        quick.log.error('500 can not to read file:\t'+request.url);
                        response.end(err);
                    } else {
                        var ext = path.extname(realPath);
                        ext = ext ? ext.slice(1) : 'unknown';
                        var contentType = $mine[ext] || "text/plain";
                        if (ext.match($expires.fileMatch)) {
                            var expires = new Date();
                            expires.setTime(expires.getTime() + $expires.maxAge * 1000);
                            response.setHeader("Expires", expires.toUTCString());
                            response.setHeader("Cache-Control", "max-age=" + $expires.maxAge);
                        }
                        response.writeHead(200, {
                            'Content-Type': contentType
                        });

                        if($rules(pathname,ext)){
                            for(extname in $transfer){
                                if(extname==ext){
                                    file = $transfer[extname](file);
                                    quick.log.ok('requested file:\t'+request.url);
                                    response.write(file, "binary");
                                    response.end();
                                    return;
                                }
                            }
                        }else{
                            quick.log.ok('requested file:\t'+request.url);
                            response.write(file, "binary");
                            response.end();
                        }
                    }
                });
            }
        });
    });
    return exports;
};