
function api_user(token) {
    return fetch(config.oauth_server+'/user', {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}

function append_api(app){
    app.get('/api/user', function (req, res) {
	res.set('Access-Control-Allow-Origin', '*')
	let token = req.query.token
	api_user(token)
	    .then(j=>res.json(j))
	    .catch(err=>res.end(err))
    })    
}

module.exports = append_api
