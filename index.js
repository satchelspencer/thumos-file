define({factory : true}, function(){
	/* server only requirements */
	var srv = node({
		crypto : nodeRequire('crypto'),
        aws : nodeRequire('aws-sdk'),  
        fs : nodeRequire('fs-extra'),
        path : nodeRequire('path'),
        skipper : nodeRequire('skipper')(),
        express : nodeRequire('express')
	});

	return {
		init : node(function(config, props, callback){
			srv.fileConfig = config.file||{};
			srv.aws.config.region = srv.fileConfig.region;

			 /* setup tmpdir */
	        srv.tmpdir = srv.fileConfig.tmpdir||srv.path.join(__dirname, 'tmp');
	        srv.fs.emptyDirSync(srv.tmpdir);
	       
	        var router = srv.express.Router(); //make a new router just for this type
			/* post route to encode a new file */
			router.route('/:identifier').post(function(req, res){
				var propConfig = props[req.params.identifier];
				if(!propConfig) res.json({error : 'unkown property: '+req.params.identifier});
				else srv.skipper(req, res, function(e){ //call skipper
					if(e) res.json({error : 'file'});
					else{
						var files = req.file('files').on('error', function(){}); 
						var file = files._files[0]; //take first file ignore the rest
						if(!file) res.json({error : 'no file'});
						else{
							/* gen random id for use in s3 */
							var id = srv.crypto.randomBytes(16).toString('hex');
							var tmppath = srv.path.join(srv.tmpdir, id);
							var ws = srv.fs.createWriteStream(tmppath);
							file.stream.pipe(ws).on('finish', function(e){
								if(e) res.json({error : 'something bad happened'});
								else{
									var output = {
										id : id,
										temporary : true,
										name : file.stream.filename,
										size : file.stream.byteCount
									};
									/* onupload handler */
									if(propConfig.onupload) propConfig.onupload(tmppath, function(e, value){
										if(value) output.value = value;
										done(e);
									})
									function done(e){
										if(e) res.json({error : e});
										else{
											/* clean up temp file after a min */
											setTimeout(function(){
												srv.fs.unlink(tmppath, function(){});	
											}, (srv.fileConfig.timeout||60)*1000);
											
											/* respond to request */
											res.json(output);
										}
									}
								}
							});
						}
					}
				});
			});
			router.route('/:identifier/:id').get(function(req, res){
				var propConfig = props[req.params.identifier];
				if(!propConfig) res.json({error : 'unkown property: '+req.params.identifier});
				else if(!req.params.id.match(/^[0-9a-f]{32}$/)) res.json({error : 'invalid id'});
				else{
					var s3 = new srv.aws.S3().getObject({Bucket: srv.fileConfig.bucket, Key : req.params.id});
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
			config.app.use(srv.fileConfig.route||'/bin', router);
			callback();
		}),	
		api : function(identifier, propConfig, callback){
			var noStore = _.has(propConfig, 'store') && !propConfig.store;
			var api = {
				encode : browser(function(value, callback){
					require('ajax').file('/bin/'+identifier, value, false, callback);
				}),
				decode : function(value, callback){
					/* generate client side api */
					var output = value.value;
					if(!noStore) output = {
						name : value.name,
						size : value.size,
						url : '/bin/'+identifier+'/'+value.id,
						value : value.value
					};
					callback(null, output);
				},
				finalize : node(function(value, callback){
					if(!_.isObject(value) || !_.isString(value.id)) callback('invalid value');
					else{
						delete value.temporary;
						if(noStore) callback(null, value);
						else{
							/* move temporary file to s3 and clean up */
							var tmppath = srv.path.join(srv.tmpdir, value.id);
							var rs = srv.fs.createReadStream(tmppath).on('error', function(e){
								callback('not found');
							});
							var s3 = new srv.aws.S3({params: {Bucket: srv.fileConfig.bucket, Key : value.id}});
							s3.upload({Body : rs}).send(function(e, data){
								if(e) res.json({error : e.toString()})
								else srv.fs.unlink(tmppath, function(e){
									callback(e, value);
								});
							});
						}
					}
				}),
				purge : node(function(value, callback){
					if(noStore) callback();
					else{
						var s3 = new srv.aws.S3();
						s3.deleteObject({Bucket: srv.fileConfig.bucket, Key : value.id}, callback);
					}
				})
			}
			callback(null, api);
		}
	}
})