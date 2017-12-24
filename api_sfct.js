let fetch = require('node-fetch')

function call_api(spath, token){
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}

function append_api_sfct(config){
    let app = express.Router()
    let oserver = config.oauth_server
    
    app.get('/auth', function(req, res){
	res.set('Access-Control-Allow-Origin', '*')
	let token = req.query.token
	call_api(oserver+'/user/repos', token)
	    .then(j=>{
		res.json(j)
	    })
	    .catch(error=>res.status(500).end(error))
    })
}

module.exports = append_api_sfct
