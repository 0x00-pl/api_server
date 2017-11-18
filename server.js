//  OpenShift sample Node application
var express   = require('express'),
    app       = express(),
    morgan    = require('morgan'),
    form_data = require('form-data'),
    fetch     = require('node-fetch'),
    entries   = require('object.entries');

if (!Object.entries) {
    entries.shim();
}

Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

Object.entries(process.env).map(([v,k])=>console.log(k,v))

let {client_id, client_secret} = process.env['OAUTH_CLIENT_ID'] ?
    {client_id: process.env['OAUTH_CLIENT_ID'], client_secret: process.env['OAUTH_CLIENT_SECRET'] } :
    require('./oauth-conf')

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";


if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
    var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
	mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
	mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
	mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
	mongoPassword = process.env[mongoServiceName + '_PASSWORD'],
	mongoUser = process.env[mongoServiceName + '_USER'];

    console.log('[debug]env: ', mongoHost, mongoPort, mongoDatabase, mongoUser, mongoPassword)
    if (mongoHost && mongoPort && mongoDatabase) {
	mongoURLLabel = mongoURL = 'mongodb://';
	if (mongoUser && mongoPassword) {
	    mongoURL += mongoUser + ':' + mongoPassword + '@';
	}
	// Provide UI label that excludes user id and pw
	mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
	mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;
    }
    console.log('[debug]mongoURL: ', mongoURL)
}

var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
    if (mongoURL == null) return;

    var mongodb = require('mongodb');
    if (mongodb == null) return;

    console.log('[debug]connecting')
    mongodb.connect(mongoURL, function(err, conn) {
	if (err) {
	    callback(err);
	    return;
	}

	db = conn;
	dbDetails.databaseName = db.databaseName;
	dbDetails.url = mongoURLLabel;
	dbDetails.type = 'MongoDB';

      console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
    // try to initialize the db on every request if it's not already
    // initialized.
    if (!db) {
	initDb(function(err){});
    }
    if (db) {
	var col = db.collection('counts');
	// Create a document with request IP and current time of request
	col.insert({ip: req.ip, date: Date.now()});
	col.count(function(err, count){
	    res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails, env : JSON.stringify(process.env) });
	});
    } else {
	res.render('index.html', { pageCountMessage : null, env : JSON.stringify(process.env)});
    }
});

app.get('/env', function (req, res) {
    res.json(process.env)
})


app.get('/oauth0', function (req, res) {
    res.redirect('https://github.com/login/oauth/authorize?client_id='+client_id)
})


app.get('/oauth1', function (req, res) {
    console.log(req.originalUrl)
    let [a, code] = req.originalUrl.split('code=')
    
    let form = new form_data();
    form.append('client_id', client_id);
    form.append('client_secret', client_secret);
    form.append('code', code);
    fetch('https://github.com/login/oauth/access_token', {method: 'POST', headers: {'Accept': 'application/json'}, body: form})
	.then(b=>b.json())
	.then(j=>{
	    let token = 'encoded:'+j.access_token
	    res.send('saving token: '+token)
	})
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

initDb(function(err){
    console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
