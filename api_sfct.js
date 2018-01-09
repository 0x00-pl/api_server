let fetch = require('node-fetch')
let express = require('express')
let body_parser = require('body-parser')

function call_api(spath, token){
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.text())
}

function append_api_sfct(config){
    let app = express.Router()
    let oserver = config.oauth_server

    app.use(body_parser.text())
    app.use(function(req, res, next){
	req.token = req.query.token
	req.args = JSON.parse(req.body)
	res.set('Access-Control-Allow-Origin', '*')
	next()
    })

    app.post('/echo', function(req, res){
	res.end(JSON.stringify(req.args, null, '  '))
    })
    
    app.post('/auth', function(req, res){
	call_api(oserver+'/user', req.token)
	    .then(j => j.login)
	    .then(username => call_api(`${oserver}/users/MarisaKirisame/following/${username}`, req.token))
	    .then(t => res.end(t))
	    .catch(error => res.status(500).end(error.message))
    })

    app.post('/auth_sfct', function(req, res){
	let token = req.query.token
    })
    
    return app
}

module.exports = append_api_sfct
