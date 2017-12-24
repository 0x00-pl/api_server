let fetch = require('node-fetch')

function call_api(spath, token){
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}

function append_api_sfct(config){
    let app = express.Router()
    app.get('/auth', function(req, res){
	
    })
}

module.exports = append_api_sfct
