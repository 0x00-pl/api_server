let fetch = require('node-fetch')
let express = require('express')
let body_parser = require('body-parser')
let { Promise } = require('es6-promise')
let { ObjectID } = require('mongodb')
let append_api_sfct_authed = require('./api_sfct_authed.js')
let append_api_sfct_cache = require('./api_sfct_cache.js')

function get_with_default(obj, prop, _default){
    if(prop in obj){
	return obj[prop]
    } else {
	return _default
    }
}

function call_api(spath, token){
    console.log('[debug]:call_github_api: ', spath)
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.text())
}

function append_api_sfct(config, db){
    let app = express.Router()
    if(!db){
	console.log('[error][sfct]: db is not avalible.')
	return app
    }
    let oserver = config.oauth_server

    app.use((req, res, next)=>{
	try {
	    next()
	} catch(err){
	    res.status(500).end(err.message)
	}
    })
    app.use(body_parser.text())
    app.use(function(req, res, next){
	req.token = req.query.token
	if(typeof req.body != 'string'){
	    req.args = {}
	} else {
	    req.args = JSON.parse(req.body)
	}
	res.set('Access-Control-Allow-Origin', '*')
	next()
    })

    app.post('/echo', function(req, res){
	res.end(JSON.stringify(req.args, null, '  '))
    })

    app.post('/user', function(req, res){
	call_api(oserver+'/user', req.token).then(JSON.parse).then(j => res.end(JSON.stringify(j, null, '  '))).catch(err => res.status(500).end(err.message))
    })
    

    db.collection('cache-auth').drop()  // drop old cache
    app.use((req, res, next)=>{
	let { voter_list, editor_list } = require('./api_sfct_auth_list.js')
	
	// cache-auth : {token, username, editor, voter}
	let token = req.token
	db.collection('cache-auth').findOne({_id:token}).then(auth=>{
	    if(auth == null){ throw Error('can not found auth') }
	    req.auth = auth
	}).catch(err=>{
	    return call_api(oserver+'/user', token).then(JSON.parse).then(user=>{
		if(!user.login){
		    throw Error('can not get user')
		}
		let username = user.login
		let editor = get_with_default(editor_list, username, true)
		let voter = get_with_default(voter_list, username, false)
		let auth = {_id:token, username, editor, voter}
		return db.collection('cache-auth').insertOne(auth).then(a=>req.auth=auth)
	    })
	}).then(a=>{
	    return next()
	}).catch(err=>{
	    res.status(500).end(err.message)
	})
    })
    app.post('/auth', (req, res)=>{
	res.end(JSON.stringify(req.auth, null, '  '))
    })
    app.post('/username', (req, res)=>{
	res.end(JSON.stringify(req.username))
    })

    append_api_sfct_authed(app, db, config)
    append_api_sfct_cache(app, db, config)

    return app
}

module.exports = append_api_sfct
