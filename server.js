//  OpenShift sample Node application
var express     = require('express'),
    app         = express(),
    morgan      = require('morgan'),
    form_data   = require('form-data'),
    fetch       = require('node-fetch'),
    entries     = require('object.entries'),
    body_parser = require('body-parser');

function pads(){
    if (!Object.entries) {
	entries.shim();
    }

    Object.assign=require('object-assign')
}
pads()

function middlewares(app){
    app.engine('html', require('ejs').renderFile);
    app.use(morgan('combined'))
}
middlewares(app)

function normalize_config(conf){
    let ret = {}
    Object.keys(conf).map(k=>{
	ret[k.toLowerCase()] = conf[k]
    })
    return ret
}
function load_config_from_default(){
    return {}
}
function load_config_from_file(){
    try {
	return normalize_config(require('./config'))
    } catch(err){
	return {}
    }
}
function load_config_from_env(){
    return normalize_config(process.env)
}
function config_alias(conf){
    conf.port = conf.port || conf.openshift_nodejs_port || 8080
    conf.ip = conf.ip || conf.openshift_nodejs_ip || '0.0.0.0'
    conf.mongourl = conf.mongourl || conf.openshift_mongodb_db_url || conf.mongo_url

    if(conf.mongourl==null && conf.database_service_name){
	let name = conf.database_service_name.toLowerCase()
	let host = conf[name+'_service_host']
	let port = conf[name+'_service_port']
	let database = conf[name+'_database']
	let password = conf[name+'_password']
	let user = conf[name+'_user']
	if (user && password){
	    conf.mongourl = `mongodb://${user}:${password}@${host}:${port}/${database}`
	} else {
	    conf.mongourl = `mongodb://${host}:${port}/${database}`
	}
    }

    return conf
}
function load_config(){
    return config_alias(
	Object.assign(
	    {},
	    load_config_from_default(),
	    load_config_from_file(),
	    load_config_from_env()
	)
    )
}

let config = load_config()

let db = null
var initDb = function(callback) {
    if (config.mongourl == null) return null;

    var mongodb = require('mongodb');
    if (mongodb == null) return null;

    console.log('[debug]: connecting db: ', config.mongourl)
    mongodb.connect(config.mongourl, function(err, conn) {
	if (err) {
	    callback(err);
	    return null;
	}
	db = conn
    });
};
initDb(console.log)

app.get('/', function (req, res) {
    if (db) {
	let col = db.collection('counts');
	// Create a document with request IP and current time of request
	col.insert({ip: req.ip, date: Date.now()});
	col.count(function(err, count){
	    res.render('index.html', { pageCountMessage : count, dbInfo: config.mongourl, env : JSON.stringify(config, null, '  ') });
	});
    } else {
	res.render('index.html', { pageCountMessage : null, env : JSON.stringify(config, null, '  ')});
    }
});

app.get('/env', function (req, res) {
    res.json(process.env)
})


app.get('/oauth0', function (req, res) {
    let cb = encodeURIComponent(req.query.cb || '/pagecount')
    let rd = encodeURIComponent(req.protocol+'://'+req.get('Host')+'/oauth1?cb='+cb)
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
	    res.redirect(req.query.cb+'?token='+token)  // redirect back
	})
	.catch(err=>res.end(err))
})

function api_user(token) {
    return fetch(config.oauth_server+'/user', {headers: {'Authorization': 'token '+token}})
	.then(b=>b.json())
}
app.get('/api/user', function (req, res) {
    res.set('Access-Control-Allow-Origin', '*')
    let token = req.query.token
    api_user(token)
	.then(j=>res.json(j))
	.catch(err=>res.end(err))
})

app.get('/api/room', function (req, res){
    res.set('Access-Control-Allow-Origin', '*')
    let token = req.query.token
    if (db) {
	let col = db.collection('room');
	col.find().sort({date:-1}).limit(50)
	    .toArray(function (err, data) {
		res.json(data)
	    })
    } else {
	res.json({err: 'no db'})
    }
})

app.use(body_parser.text())
app.post('/api/room/post', function (req, res){
    res.set('Access-Control-Allow-Origin', '*')
    let token = req.query.token
    let body = JSON.parse(req.body)
    let msg = body.msg
    if (db){
	api_user(token)
	    .then(user=>{
		let col = db.collection('room');
		let name = user.login
		col.insert({ip: req.ip, date: Date.now(), name, msg})
		col.find().sort({date:-1}).limit(50)
		    .toArray(function (err, data) {
			res.json(data)
		    })
	    })
	    .catch(e=>{
		res.json({err: 'login required'})
	    })
    } else {
	res.json({err: 'no db'})
    }
})

app.get('/pagecount', function (req, res) {
    // try to initialize the db on every request if it's not already
    // initialized.
    if (!db) {
	initDb(function(err){});
    }
    if (db) {
	db.collection('counts').count(function(err, count ){
	    res.send('{ pageCount: ' + count + '}');
	});
    } else {
	res.send('{ pageCount: -1 }');
    }
});

// error handling
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500).send('Something bad happened!');
});

app.listen(config.port, config.ip);
console.log('Server running on http://%s:%s', config.ip, config.port);

module.exports = app ;
