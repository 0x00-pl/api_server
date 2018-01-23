let fs = require('fs')
let path = require('path')

function try_read(filename){
    try{
	let content = fs.readFileSync(filename, {encoding: 'utf8'})
	return JSON.parse(content)
    }catch(err){
	return {}
    }
}

let oauth_config = ('./deployment_config/oauth.json')
let mongodb_config = require('./deployment_config/mongodb.json')

module.exports = Object.assign(
    {
	oauth_auth: 'https://github.com/login/oauth/authorize',
	oauth_access_token: 'https://github.com/login/oauth/access_token',
	oauth_server: 'https://api.github.com',
	oauth_client_id: 'undefined',
	oauth_client_secret: 'undefined',
	mongourl: 'mongodb://pl:publicpl@localhost/test'
    },
    try_read(path.join(__dirname, './deployment_config/oauth.json')),
    try_read(path.join(__dirname, './deployment_config/mongodb.json'))
)
