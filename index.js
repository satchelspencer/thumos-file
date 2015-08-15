/* built in file handling plugin */
define(['underscore', 'async', 'ajax'], function(_, async, ajax){
	return {
		name : 'file',
		encode : function(value, callback){
			if(typeof window == 'undefined' || value.constructor != File) callback(null, value);
			else ajax.file('/bin', value, false, callback);
		},
		decode : function(value, callback){
			callback(null, value);
		}
	}
});