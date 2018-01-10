let fetch = require('node-fetch')
let express = require('express')
let body_parser = require('body-parser')
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
    
    app.post('/auth', function(req, res){
	call_api(oserver+'/user', req.token)
	    .then(j => j.login)
	    .then(username => call_api(`${oserver}/users/MarisaKirisame/following/${username}`, req.token))
	    .then(t => res.end(t))
	    .catch(error => res.status(500).end(error.message))
    })

    // book : {name, chapter_list:[id]}
    // chapter : {name, book_id, block_list:[id]}
    // block : {origin, trans_list:[id]}
    // trans : {owner, vote, trans_text}
    // user : {name}
    app.post('/put_book', function(req, res){
	let book = req.args.book
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
	    let book_id = req.args.book_id
	    db_book
		.findOne({_id: ObjectID(book_id)}, find_cb)
	} else if(req.args.book_name) {
	    let book_name = req.args.book_name
	    db_book
		.findOne({name: book_name}, find_cb)
	} else {
	    res.status(500).end('needs {book_id} of {book_name}')
	}
    })

    app.post('/add_chapter', function(req, res){
	let chapter = req.args.chapter
	chapter.block_list = []
	if(!chapter || !chapter.book_id){
	    res.status(500).end('needs {name, book_id}')
	} else {
	    db.collection('chapter')
		.insert(chapter, function(err){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			let book_id = chapter.book_id
			let chapter_id = chapter._id
			db.collection('book')
			    .update(
				{_id:ObjectID(book_id)},
				{$addToSet: {chapter_list: chapter_id}},
				function(err){
				    if(err){
					res.status(500).end(err.message)
				    } else {
					res.end(JSON.stringify(chapter, null, '  '))
				    }
				})
		    }
		})
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
	    let chapter_id = req.args.chapter_id
	    db_chapter
		.find({_id: ObjectID(chapter_id)}, find_cb)
	} else if(req.args.book_id && req.args.chapter_name){
	    let book_id = req.args.book_id
	    let chapter_name = req.args.chapter_name
	    db_chapter
		.find({book_id, name:chapter_name}, find_cb)
	} else {
	    res.status(500).end('needs {chapter_id} or {book_id, chapter_name}')
	}
    })

    app.post('/add_block', function(req, res){
	let block = req.args.block
	if(!block || !block.origin){
	    res.status(500).end('needs {origin}')
	} else {
	    block.trans_list = []
	    db.collection('block')
		.insert(block, function(err){
		    if(err){
			res.status(500).end(err.message)
		    } else {
			let block_id = block._id
			db.collect('chapter')
			    .update(
				{_id:ObjectID(book_id)},
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
	    let block_id = req.args.block_id
	    db.collection('block')
		.find({_id:ObjectID(block_id)}, function(err, result){
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

    
    return app
}

module.exports = append_api_sfct
