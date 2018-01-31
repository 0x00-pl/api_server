let fetch = require('node-fetch')
let express = require('express')
let { Promise } = require('es6-promise')
let { ObjectID } = require('mongodb')

function append_api_sfct_cache(app, db, config){
    app = app || express.Router()
    if(!db){
	console.log('[error][sfct]: db is not avalible.')
	return app
    }

    // cache-trans-refed : {_id=trans._id, refed}
    app.post('/cache-trans-refed', (req, res)=>{
	db.collection('cache-trans-refed').drop().then(a=>{
	    return db.collection('trans', db.version()==2.6 ? {_id:1} : {projection:{_id:1}}).find().toArray()
	}).then(trans_list=>{
	    return Promise.all(
		trans_list.map(trans_id=>{
		    return db.collection('block').count({trans_list: trans_id}).then(n=>{_id:trans_id, refed:n})
		})
	    )
	}).then(cache_trans_refed_list=>{
	    return db.collection('cache-trans-refed').insertMany(cache_trans_refed_list)
	}).then(a=>{
	    res.end('ok')
	})
    })
    app.post('/get-trans-refed', (req, res)=>{
	let trans_list = req.args.trans_list || [req.args.trans_id]
	trans_list = trans_list.map(trans_id=>ObjectID(trans_id))
	db.collection('cache-trans-refed').find({_id: {$in: trans_list}}).toArray(trans_refed_list=>{
	    res.end(JSON.stringify(trans_refed_list, null, '  '))
	})
    })

    // cache-block-transed : {_id=block._id, transed}
    app.post('/cache-block-transed', (req, res)=>{
	db.collection('cache-block-transed').drop().then(a=>{
	    return db.collection('block').find().toArray()
	}).then(block_list=>{
	    return block_list.map(block=>{
		return db.collection('trans').findOne({_id:{$in:block.trans_list}, vote:{$gt:0}}).then(t=>{
		    return {_id:block._id, transed: t!=null}
		})
	    })
	}).then(Promise.all).then(block_transed_list=>{
	    return db.collection('chahe-block-transed').insertMany(block_transed_list)
	}).then(a=>{
	    res.end('ok')
	})
    })
    
    return app
}
