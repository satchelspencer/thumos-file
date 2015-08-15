var crypto = require('crypto');
var aws = require('aws-sdk');
aws.config.region = 'us-west-2';
var fs = require('fs');
var path = require('path');
var skipper = require('skipper')();
var express = require('express');	

module.exports = function(config){
	var api = {
		init : function(gconfig, callback){
			var router = express.Router();
			/* post route to encode a new file */
			router.route('/').post(function(req, res){
				skipper(req, res, function(e){ //call skipper
					if(e) res.json({error : 'file'});
					else{
						var files = req.file('files').on('error', function(){}); 
						var file = files._files[0]; //take first file ignore the rest
						if(!file) res.json({error : 'no file'});
						else{
							/* gen random id for use in s3 */
							var id = crypto.randomBytes(16).toString('hex');
							var tmppath = path.join(config.tmpdir, id);
							var ws = fs.createWriteStream(tmppath);
							file.stream.pipe(ws).on('finish', function(e){
								if(e) res.json({error : 'something'});
								else{
									/* clean up after a min */
									setTimeout(function(){
										fs.unlink(tmppath, function(){});	
									}, (config.timeout||60)*1000);
									
									/* respond to request */
									res.json({
										id : id,
										temporary : true,
										name : file.stream.filename,
										size : file.stream.byteCount
									});
								}
							});
						}
					}
				});
			});
			router.route('/:id').get(function(req, res){
				if(!req.params.id.match(/^[0-9a-f]{32}$/)) res.json({error : 'invalid id'});
				else{
					var s3 = new aws.S3().getObject({Bucket: config.bucket, Key : req.params.id});
					var ds = s3.createReadStream();
					ds.on('error', function(){
						res.json({error : 'not found'});
					});
					ds.on('finish', function(){
						res.end();
					});
					ds.pipe(res);
				}
			});
			gconfig.app.use('/bin', router);
			callback();
		},
		finalize : function(value, callback){
			/* move temporary file to s3 and clean up */
			var tmppath = path.join(config.tmpdir, value.id);
			var rs = fs.createReadStream(tmppath).on('error', function(e){
				callback('not found');
			});
			var s3 = new aws.S3({params: {Bucket: config.bucket, Key : value.id}});
			s3.upload({Body : rs}).send(function(e, data){
				if(e) res.json({error : e.toString()})
				else fs.unlink(tmppath, function(e){
					delete value.temporary;
					callback(e, value);
				});
			});
		},
		purge : function(value, callback){
			var s3 = new aws.S3();
			s3.deleteObject({Bucket: config.bucket, Key : value.id}, callback);
		}
	}
	return api;
}