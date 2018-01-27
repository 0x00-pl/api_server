let fetch = require('node-fetch')
let express = require('express')
let body_parser = require('body-parser')
let { Promise } = require('es6-promise')
let { ObjectID } = require('mongodb')

function call_api(spath, token){
    console.log('[debug]:call_api: ', spath)
    return fetch(spath, {headers: {'Authorization': 'token '+token}})
	.then(b=>b.text())
}

function append_api_sfct(config, db){
    let app = express.Router()
    if(!db){
	console.log('[error][sfct]: db is not avalible.')
	return app
    }
    let oserver = config.oauth_server

    app.use(body_parser.text())
    app.use(function(req, res, next){
	req.token = req.query.token
	req.args = JSON.parse(req.body)
	res.set('Access-Control-Allow-Origin', '*')
	next()
    })

    app.post('/echo', function(req, res){
	res.end(JSON.stringify(req.args, null, '  '))
    })

    app.post('/user', function(req, res){
	call_api(oserver+'/user', req.token).then(JSON.parse).then(j => res.end(JSON.stringify(j, null, '  '))).catch(err => res.status(500).end(err.message))
    })
    app.post('/auth', function(req, res){
	call_api(oserver+'/user', req.token)
	    .then(JSON.parse)
	    .then(j => j.login)
	    .then(username => {
		return call_api(`${oserver}/users/MarisaKirisame/following/${username}`, req.token).then(t => {
		    return res.end(JSON.stringify({username}))
		})
	    }).catch(error => res.status(500).end(error.message))
    })
    
    api.get('/username', function(require,res){
	res.set('Access-Control-Allow-Origin', '*')
	let token = req.query.token
	call_api(oserver+'/user', token)
	    .then(j=>res.json(j.login))
	    .catch(err=>res.status(500).end(err))
    })

    // book : {name, chapter_list:[id]}
    // chapter : {book_id, name, block_list:[id]}
    // block : {chapter_id, origin, status, trans_list:[id]}
    // trans : {user_id, vote, origin, text}
    // user : {name}
    app.post('/add_book', function(req, res){
	let book = req.args
	if(!book || !book.name){
	    res.status(500).end('needs {name}')
	} else {
	    book.chapter_list = []
	    db.collection('book')
		.insert(book, function(err){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			res.end(JSON.stringify(book, null, '  '))
		    }
		})
	}
    })
    app.post('/get_book', function(req, res){
	function find_cb(err, book){
	    if(err){
		res.status(500).end(err.message)
	    } else {
		res.end(JSON.stringify(book, null, ' '))
	    }
	}
	let db_book = db.collection('book')
	if(req.args.book_id){
	    let book_id = ObjectID(req.args.book_id)
	    db_book
		.findOne({_id: book_id}, find_cb)
	} else if(req.args.book_name) {
	    let book_name = req.args.book_name
	    db_book
		.findOne({name: book_name}, find_cb)
	} else {
	    res.status(500).end('needs {book_id} of {book_name}')
	}
    })
    app.post('/get_book_list', function(req, res){
	db.collection('book').find().toArray().then(book_list=>{
	    res.end(JSON.stringify(book_list, null, '  '))
	}).catch(err=>res.status(500).end(err.message))
    })
    app.post('/get_book_chapter', function(req, res){
	function find_cb(err, book){
	    if(err){
		res.status(500).end(err.message)
	    } else {
		let chapter_list = book.chapter_list
		db.collection('chapter')
                //.find({_id: {$in: chapter_list}}, {projection:{'block_list':0}})
		    .find({_id: {$in: chapter_list}}, {'block_list':0}) // use mongodb 2.6 api
                    .toArray(function(err, chapter_list){
			book.chapter_list = chapter_list
			res.end(JSON.stringify(book, null, '  '))
                    })
            }
	}

	let db_book = db.collection('book')
	if(req.args.book_name){
            let book_name = req.args.book_name
            db_book.findOne({name: book_name}, find_cb)
	} else if(req.args.book_id){
            let book_id = ObjectID(req.args.book_id)
            db_book.findOne({_id: book_id}, find_cb)
	} else {
            res.status(500).end('needs {book_id} or {book_name}')
	}
    })
    
    app.post('/add_chapter', function(req, res){
	let chapter = req.args
	chapter.block_list = []
	if(!chapter || !chapter.book_id){
	    res.status(500).end('needs {book_id, name}')
	} else {
	    chapter.book_id = ObjectID(chapter.book_id)
	    db.collection('chapter').insert(chapter).then(a=>{
		let book_id = ObjectID(chapter.book_id)
		let chapter_id = chapter._id
		return db.collection('book').update(
		    {_id: book_id},
		    {$addToSet: {chapter_list: chapter_id}}
		)
	    }).then(a=>{
		res.end(JSON.stringify(chapter, null, '  '))
	    }).catch(err=>res.status(500).end(err.message))
	}
    })
    app.post('/get_chapter', function(req, res){
	function find_cb(err, result){
	    if(err){
		res.status(500).end(err.message)
	    } else {
		res.end(JSON.stringify(result, null, '  '))
	    }
	}
	let db_chapter = db.collection('chapter')
	if(req.args.chapter_id){
	    let chapter_id = ObjectID(req.args.chapter_id)
	    db_chapter
		.findOne({_id: chapter_id}, find_cb)
	} else if(req.args.book_id && req.args.chapter_name){
	    let book_id = ObjectID(req.args.book_id)
	    let chapter_name = req.args.chapter_name
	    db_chapter
		.findOne({book_id, name:chapter_name}, find_cb)
	} else {
	    res.status(500).end('needs {chapter_id} or {book_id, chapter_name}')
	}
    })
    app.post('/get_chapter_block_trans', function(req, res){
	function fill_trans(trans){
	    return db.collection('user').findOne({_id: trans.user_id}).then(user=>{
		trans.user = user
		return trans
	    })
	}
	function fill_block(block){
	    return db.collection('trans').find({_id: {$in: block.trans_list}}).toArray().then(trans_list=>{
		return Promise.all(trans_list.map(fill_trans))
	    }).then(trans_list=>{
		block.trans_list = trans_list
		return block
	    })
	}
	function fill_chapter(chapter){
	    return db.collection('block').find({_id: {$in: chapter.block_list}}).toArray().then(block_list=>{
		return Promise.all(block_list.map(fill_block))
	    }).then(block_list=>{
		chapter.block_list = block_list
		return chapter
	    }).then(chapter=>{
		return db.collection('book').findOne({_id: chapter.book_id}).then(book=>{
		    chapter.book = book
		    return chapter
		})
	    })
	}
	function find_cb(err, chapter){
	    if(err){
		res.status(500).end(err.message)
	    } else {
		fill_chapter(chapter).then(chapter=>{
		    res.end(JSON.stringify(chapter, null, '  '))
		}).catch(function(err){
		    res.status(500).end(err.message)
		})
	    }
	}
	
	if(req.args.chapter_id){
	    let chapter_id = ObjectID(req.args.chapter_id)
	    db.collection('chapter').findOne({_id: chapter_id}, find_cb)
	} else if(req.args.book_name && req.args.chapter_name){
	    let book_name = req.args.book_name
	    let chapter_name = req.args.chapter_name
	    db.collection('book').findOne({name: book_name}, function(err, book){
		let book_id = book._id
		db.collection('chapter').findOne({book_id, name: chapter_name}, find_cb)
	    })
	    
	} else {
	    res.status(500).end('needs {chapter_id} or {book_name, chapter_name}')
	}
    })

    app.post('/add_block', function(req, res){
	let block = req.args
	if(!block || !block.chapter_id || !block.origin){
	    res.status(500).end('needs {chapter_id, origin}')
	} else {
	    block.trans_list = []
	    block.status = 'unverified'
	    db.collection('block')
		.insert(block, function(err){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			let chapter_id = ObjectID(block.chapter_id)
			let block_id = block._id
			db.collection('chapter')
			    .updateOne(
				{_id: chapter_id},
				{$addToSet: {block_list: block_id}},
				function(err){
				    if(err){
					res.status(500).end(err.message)
				    } else {
					res.end(JSON.stringify(block, null, '  '))
				    }
				})
		    }
		})
	}
    })
    app.post('/get_block', function(req, res){
	if(req.args.block_id){
	    let block_id = ObjectID(req.args.block_id)
	    db.collection('block')
		.findOne({_id: block_id}, function(err, result){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			res.end(JSON.stringify(result, null, '  '))
		    }
		})
	} else {
	    res.status(500).end('needs {block_id}')
	}
    })

    app.post('/add_trans', function(req, res){
	let trans = req.args
	if(!trans || !trans.text || !trans.origin){
	    res.status(500).end('needs {origin, text}')
	} else {
	    let token = req.token
	    call_api(oserver+'/user', req.token).then(JSON.parse).then(j => j.login).then(username => {
		return db.collection('user').findOne({name: username}).then(user=>{
		    return user._id
		}).catch(err=>{
		    let user = {name: username}
		    return db.collection('user').insertOne(user).then(a=>{
			return user._id
		    })
		})
	    }).then(user_id => {
		trans.user_id = user_id
		trans.vote = 0

		return db.collection('trans').insert(trans).then(a=>{
		    let origin = trans.origin
		    return db.collection('block').updateMany(
			{origin},
			{$addToSet: {trans_list: trans._id}}
		    )
		})
	    }).then(a=>{
		res.end(JSON.stringify(trans, null, '  '))
	    }).catch(err=>{
		res.status(500).end(err.message)
	    })
	}
    })
    app.post('/get_trans', function(req, res){
	if(!req.args.trans_id){
	    res.status(500).end('needs {trans_id}')
	} else {
	    let trans_id = ObjectID(req.args.trans_id)
	    db.collection('trans').findOne({_id: trans_id}).then(trans=>{
		res.end(JSON.stringify(trans, null, '  '))
	    }).catch(err=>res.status(500).end(err.message))
	}
    })
    app.post('/vote_trans', function(req, res){
	if(!req.args.trans_id || !req.args.value){
	    res.status(500).end('needs {trans_id, value}')
	} else {
	    let trans_id = ObjectID(req.args.trans_id)
	    let value = req.args.value>0 ? 1 : -1
	    db.collection('trans').updateOne({_id: trans_id}, {$inc: {vote: value}}).then(a=>{
		res.end('ok')
	    }).catch(err => res.status(500).end(err.message))
	}
    })

    app.post('/add_user', function(req, res){
	let user = req.args
	if(!user || !user.name){
	    res.status(500).end('needs {name}')
	} else {
	    db.collection('user')
		.insert(user, err=>{
		    if(err){
			res.status(500).end(err.message)
		    } else {
			res.end(JSON.stringify(user, null, '  '))
		    }
		})
	}
    })
    app.post('/get_user', function(req, res){
	if(!req.args.user_id){
	    res.status(500).end('needs {user_id}')
	} else {
	    let user_id = ObjectID(req.args.user_id)
	    db.collection('user')
		.findOne({_id: user_id}, function(err, user){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			res.end(JSON.stringify(user, null, '  '))
		    }
		}) 
	}
    })
    
    return app
}

module.exports = append_api_sfct
