//  OpenShift sample Node application
var express     = require('express'),
    app         = express(),
    morgan      = require('morgan'),
    form_data   = require('form-data'),
    fetch       = require('node-fetch'),
    entries     = require('object.entries'),
    body_parser = require('body-parser')

let config = require('./load_config')()

function pads(){
    if (!Object.entries) {
	entries.shim();
    }

    Object.assign = require('object-assign')
}
pads()

function middlewares(app){
    app.engine('html', require('ejs').renderFile);
    app.use(morgan('combined'))
    app.use(body_parser.text())
}
middlewares(app)

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
	    res.render('index.html', { pageCountMessage: count, dbInfo: config.mongourl });
	});
    } else {
	res.render('index.html', { pageCountMessage: null });
    }
});

app.get('/config', function (req, res) {
    res.json(config)
})

require('./oauth')(app, config)
app.use('/api', require('./api')(config))
app.use('/api/room', require('./api_room')(config, db))
app.use('/api/sfct', require('./api_sfct.js')(config))

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
