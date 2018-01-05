let fetch = require('node-fetch')

function call_api(spath, token){
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}

function append_api_sfct(config){
    let app = express.Router()
    let oserver = config.oauth_server

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
	res.set('Access-Control-Allow-Origin', '*')
	let token = req.query.token
	call_api(oserver+'/user/repos', token)
	    .then(j=>{
		res.json(j)
	    })
	    .catch(error=>res.status(500).end(error))
    })

    app.post('/auth_sfct', function(req, res){
	let token = req.query.token
    })
    
    return app
}

module.exports = append_api_sfct
