/* built in file handling plugin */
define(['underscore', 'async'], function(_, async){
	return {
		name : 'file',
		init : function(thumos, prequire, nodeRequire, router, config, setConfig, propName, callback){
			var crypto = prequire('crypto');
			
			var aws = nodeRequire('aws-sdk');
			aws.config.region = 'us-west-2';
			var skipper = nodeRequire('skipper')();			
			
			router.route('/')
			.post(function(req, res, next){
				skipper(req, res, function(e){ //call skipper
					if(e) res.json({error : 'file'});
					else{
						var files = req.file('files').on('error', function(){}); 
						var file = files._files[0]; //take first file ignore the rest
						if(!file) res.json({error : 'no file'});
						else{
							/* gen random id for use in s3 */
							var id = crypto.randomBytes(16).toString('hex');
							var s3 = new aws.S3({params: {Bucket: 'transcendencelaw', Key : setConfig.name+'/'+propName+'/'+id}});
							s3.upload({Body : file.stream}).send(function(e, data){
								if(e) res.json({error : e.toString()})
								else res.json({
									id : id,
									name : file.stream.filename,
									size : file.stream.byteCount
								});
							});	
						}
					}
				});	
			})
			.delete(function(req, res, next){
				
			});
			
			callback();
		},
		encode : function(inp, callback){
			var ajax = require('ajax');
		},
		decode : function(inp, callback){
			
		},
		remove : function(id, callback){
		
		}
	}
});