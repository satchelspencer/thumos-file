# thumos-file
property plugin for [thumos](https://github.com/satchelspencer/thumos/), allows storage and manipulation of files in thumos. storage mechanism is currently s3

# usage
 - prior to encoding, a [file object](https://developer.mozilla.org/en-US/docs/Web/API/File) (from a file picker, dropevent etc) is expected.
 - once encoded the property has the api:
   - `name` name of original file uploaded
   - `size` size (bytes) of file
   - `url` url to download file with get request
   - `value` the output of `onupload` (if any)
 - if the `store` option is false the value of the property will simply be the output of `onupload`

# global options
global options are passed as the `file` property in [thumos' config object](https://github.com/satchelspencer/thumos/#configuration) required options are:
 - `bucket` name of s3 bucket to use
 - `region` name of s3 region to use
 - `tmpdir` path to local directory to store temporary files
 - `timeout` removal delay for temporary files (seconds). defaults to 60.
 - `route` path for [express route](http://expressjs.com/4x/api.html#router) for file upload service. defaults to `/bin`
 
# property options
thumos-file looks for the following options in the property config object. none are required
 - `onupload : function(localPath, callback)`
 - `store` bool (default true) if false: file will not be stored, only the value returned from `onupload` will be stored
