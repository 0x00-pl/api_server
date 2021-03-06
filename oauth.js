let form_data = require('form-data')
let fetch = require('node-fetch')
let { URL } = require('url')

function append_oauth(app, config){
    app.get('/oauth0', function(req, res){
	let cb = encodeURIComponent(req.query.cb || '/pagecount')
        let protocol = req.get('X-Forwarded-Proto') || req.protocol
	let rd = encodeURIComponent(protocol+'://'+req.get('Host')+'/oauth1?cb='+cb)
	res.redirect(config.oauth_auth+'?client_id='+config.oauth_client_id+'&redirect_uri='+rd)
    })

    app.get('/oauth1', function (req, res) {
	let [a, code] = req.originalUrl.split('code=')
	let form = new form_data();
	form.append('client_id', config.oauth_client_id)
	form.append('client_secret', config.oauth_client_secret)
	form.append('code', code)
	fetch(config.oauth_access_token, {method: 'POST', headers: {'Accept': 'application/json'}, body: form})
	    .then(b=>b.json())
	    .then(j=>{
		let token = j.access_token
		let next = new URL(decodeURIComponent(req.query.cb)) //TODO: URL need nodejs version 7+
		next.searchParams.append('token', token)
		res.redirect(next.href)
	    })
	    .catch(err=>{
		console.log(err)
		res.end(err.message)
	    })
    })
}

module.exports = append_oauth
