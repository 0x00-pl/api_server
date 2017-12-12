//  OpenShift sample Node application
var express     = require('express'),
    app         = express(),
    morgan      = require('morgan'),
    form_data   = require('form-data'),
    fetch       = require('node-fetch'),
    entries     = require('object.entries'),
    body_parser = require('body-parser')

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

    if(conf.database_service_name){
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


app.use(body_parser.text())

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

require('./oauth')(app)
require('./api')(app)
require('./api_room')(app, db)

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
