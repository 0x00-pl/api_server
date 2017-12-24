let express = require('express')

function append_api_room(config, db){
    let app = express.Router()
    app.get('/', function (req, res){
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

    app.post('/post', function (req, res){
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
    return app
}

module.exports = append_api_room
