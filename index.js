define({
	encode : browser(function(value, callback){
		require('ajax').file('/bin', value, false, callback);
	}),
	decode : function(value, callback){
		callback(null, value);
	},
	server : node(function(config, callback){
        var fileConfig = config.file||{};
        
        var crypto = nodeRequire('crypto');
        var aws = nodeRequire('aws-sdk');   
        aws.config.region = fileConfig.region;
        var fs = nodeRequire('fs-extra');
        var path = nodeRequire('path');
        var skipper = nodeRequire('skipper')();
        var express = nodeRequire('express');	
        
        /* setup tmpdir */
        var tmpdir = fileConfig.tmpdir||path.join(__dirname, 'tmp');
        fs.emptyDirSync(tmpdir);
       
        var router = express.Router(); //make a new router just for this type
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
						var tmppath = path.join(tmpdir, id);
						var ws = fs.createWriteStream(tmppath);
						file.stream.pipe(ws).on('finish', function(e){
							if(e) res.json({error : 'something'});
							else{
								/* clean up after a min */
								setTimeout(function(){
									fs.unlink(tmppath, function(){});	
								}, (fileConfig.timeout||60)*1000);
								
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
				var s3 = new aws.S3().getObject({Bucket: fileConfig.bucket, Key : req.params.id});
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
		
		config.app.use('/bin', router);
                                
        var api = {
    	   finalize : function(value, callback){
    			/* move temporary file to s3 and clean up */
    			var tmppath = path.join(tmpdir, value.id);
    			var rs = fs.createReadStream(tmppath).on('error', function(e){
    				callback('not found');
    			});
    			var s3 = new aws.S3({params: {Bucket: fileConfig.bucket, Key : value.id}});
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
    			s3.deleteObject({Bucket: fileConfig.bucket, Key : value.id}, callback);
    		}
	   }
	   callback(null, api);
	})
});