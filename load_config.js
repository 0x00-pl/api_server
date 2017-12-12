
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

module.exports = load_config
