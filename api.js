let fetch = require('node-fetch')
let express = require('express')

function api_user(token, config) {
    return fetch(config.oauth_server+'/user', {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}

function append_api(config){
    let app = express.Router()
    app.get('/user', function (req, res) {
	res.set('Access-Control-Allow-Origin', '*')
	let token = req.query.token
	api_user(token, config)
	    .then(j=>res.json(j))
	    .catch(err=>res.status(500).end(err))
    })
    return app
}

module.exports = append_api
