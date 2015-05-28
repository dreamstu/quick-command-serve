/**
 * Created by johnkim on 15-1-20.
 */
var path = require('path');
var fs = require('fs');
var http = require('http');
var url = require('url');
var rDefine = /define\(\s*(['"](.+?)['"],)?/;
        
//默认配置
var confs = {
    mine: { //mine类型
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
    rules: function(pathname, ext) { //执行wrap条件，用户可覆盖此默认配置
        return pathname.indexOf('static/page') != -1 && ext == 'js';
    },
    transfer: { //转换器，用户可覆盖或修改默认配置
        js: function(content) {
            if(rDefine.test(content)){//如果已经存在包装了，就直接返回原￥数据
                return content;
            }
            return [
                'define(function(require, exports, module) {\n',
                content,
                '\n});'
            ].join('');
        }
    }
};

module.exports = initServer = function(quick) {
    var exports = {};

    confs = quick.util.merge(quick.config.serve || {}, confs);
    var $mine = confs.mine;
    var $rules = confs.rules;
    var $transfer = confs.transfer;
    var $combo = confs.combo;
    var $basePath = (quick.config.serve.root_temp != '' ?
        quick.config.serve.root_temp :
        (quick.util._.has(confs, 'root') ?
            confs.root :
            process.cwd()));

    quick.log.ok('用户设定监听路径为：\n' + $basePath);

    exports.server = http.createServer(function(request, response) {
        var pathname = url.parse(request.url);
        if (pathname.pathname == '/') {
            response.writeHead(200, {
                'Content-Type': 'text/html;charset=utf-8'
            });
            response.write("<xmp theme='united' style='display:none;'>"+fs.readFileSync(path.join(__dirname,'..','/README.md'),{encoding:'utf8'})+"</xmp><script src='http://strapdownjs.com/v/0.2/strapdown.js'></script>",'utf8');
            response.end();
            return;
        } else {
            pathname = url.parse(request.url).path;
        }
        var splitIndex = pathname.indexOf('??');
        if (splitIndex != -1) {
            var commonPath = pathname.slice(0, splitIndex);
            var last = commonPath.slice(commonPath.length-1);
            if(last!='/' && last!='\\'){//如果没在??后面写上/，则做个302跳转，并自动加上/
                response.writeHead(302, {
                    'Content-Type': 'text/plain',
                     'Location': pathname.replace('??','/??')
                });
                response.end();
                return;
            }
            var names = pathname.slice(splitIndex + 2, pathname.length).split(',');
            var sb = [];
            names.forEach(function(name, idx) {
                var realPath = path.join($basePath, commonPath, name);
                fs.exists(realPath, function(exists) {
                    if (!exists) {
                        response.writeHead(404, {
                            'Content-Type': 'text/plain'
                        });
                        quick.log.error('404 failure to request file:\t' + request.url);
                        response.write("This request URL " + name + " was not found on this server.");
                        response.end();
                        return;
                    } else {
                        fs.readFile(realPath, "binary", function(err, file) {
                            if (err) {
                                response.writeHead(500, {
                                    'Content-Type': 'text/plain'
                                });
                                quick.log.error('500 can not to read file:\t' + request.url);
                                response.end(err);
                                return;
                            } else {
                                var ext = path.extname(realPath);
                                ext = ext ? ext.slice(1) : 'unknown';
                                var contentType = $mine[ext] || "text/plain";
                                response.writeHead(200, {
                                    'Content-Type': contentType
                                });
                                if ($rules(pathname, ext)) {
                                    for (extname in $transfer) {
                                        if (extname == ext) {
                                            file = $transfer[extname](file);
                                            quick.log.ok('requested file:\t' + request.url);
                                            sb.push(file);
                                            if (idx == names.length - 1) {
                                                response.write(sb.join('\n'), "binary");
                                                response.end();
                                                return;
                                            }
                                        }
                                    }
                                } else {
                                    quick.log.ok('requested file:\t' + request.url);
                                    sb.push(file);
                                    if (idx == names.length - 1) {
                                        response.write(sb.join('\n'), "binary");
                                        response.end();
                                        return;
                                    }
                                }
                            }
                        });
                    }
                });
            });
        } else {
            var realPath = path.join($basePath, pathname);
            fs.exists(realPath, function(exists) {
                if (!exists) {
                    response.writeHead(404, {
                        'Content-Type': 'text/plain'
                    });
                    quick.log.error('404 failure to request file:\t' + request.url);
                    response.write("This request URL " + pathname + " was not found on this server.");
                    response.end();
                } else {
                    fs.readFile(realPath, "binary", function(err, file) {
                        if (err) {
                            response.writeHead(500, {
                                'Content-Type': 'text/plain'
                            });
                            quick.log.error('500 can not to read file:\t' + request.url);
                            response.end(err);
                        } else {
                            var ext = path.extname(realPath);
                            ext = ext ? ext.slice(1) : 'unknown';
                            var contentType = $mine[ext] || "text/plain";
                            response.writeHead(200, {
                                'Content-Type': contentType
                            });

                            if ($rules(pathname, ext)) {
                                for (extname in $transfer) {
                                    if (extname == ext) {
                                        file = $transfer[extname](file);
                                        quick.log.ok('requested file:\t' + request.url);
                                        response.write(file, "binary");
                                        response.end();
                                        return;
                                    }
                                }
                            } else {
                                quick.log.ok('requested file:\t' + request.url);
                                response.write(file, "binary");
                                response.end();
                            }
                        }
                    });
                }
            });
        }
    });
    return exports;
};