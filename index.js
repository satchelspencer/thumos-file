/* built in file handling plugin */
define(function(require, exports, module){
	return {
		init : function(nodeRequire, config, callback){
			var aws = nodeRequire('aws-sdk');
			var skipper = nodeRequire('skipper');
			callback();
		},
		encode : function(inp, callback){
			
		},
		decode : function(inp, callback){
			
		},
		remove : function(id, callback){
		
		}
	}
});