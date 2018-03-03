dhtc_ll=require("./dhtc_ll.js");
crypto = require('crypto');
require('./ninfo');

var genNeighborID = function(target, nid) {
    return  Buffer.concat([target.slice(0, 10), nid.slice(10)]);
}

var randomID = function() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
};

var startupNodes=[   
		{ip:'router.bittorrent.com', port:6881},
		{ip:'dht.transmissionbt.com', port:6881},
		{ip:'87.98.162.88',port:6881},
		{ip:'41.75.78.113', port:6881}
];

NodeInfoQuery=function(maxSize){
	this.maxSize=maxSize;
	this.q=[];
}

NodeInfoQuery.prototype.add=function(node){
	if(this.q.length >= this.maxSize)
		return;
	this.q.push(node);
}

NodeInfoQuery.prototype.clear=function(node){
	this.q=[];
}


function DHTClient(){
	this.nid=randomID();    
	this.table = new NodeInfoQuery(300);
};

dhtc=new DHTClient;

DHTClient.prototype.onUdpListen=function(){
	console.log('Listen');
}


DHTClient.prototype.onAnnouncePeerRequest = function(node, msg) {
	var port;
    console.log("+++ +onAnnouncePeerRequest");
    console.log(msg);
    try {
        var infohash = msg.a.info_hash;
        var token = msg.a.token;
        var nid = msg.a.id;
        var tid = msg.t;

        if (tid == undefined) {
            throw new Error;
        }
    }
    catch (err) {
        return;
    }

    if (infohash.slice(0, 2).toString() != token.toString()) {
        return;
    }

    if (msg.a.implied_port != undefined && msg.a.implied_port != 0) {
        port = node.port;
    }
    else {
        port = msg.a.port || 0;
    }

    if (port >= 65536 || port <= 0) {
        return;
    }
//	dhtc_ll.sendAnnouncepeerResponse(this.udp, tid, genNeighborID(nid, this.nid), {address: node.ip, port: node.port})
    console.log("magnet:?xt=urn:btih:%s from %s:%s", infohash.toString("hex"), node.ip, node.port);
};


DHTClient.prototype.onGetPeersRequest = function(node,msg) {
//	console.log("onGetPeersRequest++");
    try {
        var infohash = msg.a.info_hash;
        var tid = msg.t;
        var nid = msg.a.id;
        var token = infohash.slice(0, 2);

        if (tid === undefined || infohash.length != 20 || nid.length != 20) {
            throw new Error;
        }
    }
    catch (err) {
        return;
    }
//	dhtc_ll.sendGetPeerResponseWithNode(this.udp, node.tid, genNeighborID(infohash, this.nid), token, '', {address: node.ip, port: node.port})
	dhtc_ll.sendGetPeerResponseWithNode(this.udp, tid, genNeighborID(infohash, this.nid), token, '', {address: node.ip, port: node.port})
// **IMPORTANT 1**:  Here, if tid is error, No announce_peer can be received
};

DHTClient.prototype.handleMsg=function(node, msg){
	if( (msg.y=='r') && (msg.r) && (! msg.r.nodes) ){    // resp for 'ping'
		console.log('resp of Ping');	
	}else if((msg.y=='r') && (msg.r) && (msg.r.nodes)){  //resp for 'find_node', add these node to query
		nodelistFromResp=dhtc_ll.decodeNodes(msg.r.nodes);
		for(i=0; i<nodelistFromResp.length; i++){
			nn = new NodeInfo(nodelistFromResp[i].address, nodelistFromResp[i].port, nodelistFromResp[i].nid)
			//console.log(nn);
			this.table.add(nn)
		}
//		console.log(this.table.q.length);
		return ;
	}else if( (msg.y=='q')  ){		
		if(msg.q=='ping'){
		//	console.log("query ping ");
		}else if( msg.q=='find_node'){
		//	console.log("query find_node ");
		}else if( msg.q=='announce_peer'){
			this.onAnnouncePeerRequest(node,msg);
		}else if( msg.q== 'get_peers'){
			this.onGetPeersRequest(node, msg);
		}else{
			console.log("query TBD ");
		}
	}else if((msg.y=='e')){			
		console.log('error ');
	}else if((!msg.y) && (!msg.t) &&(!msg.q) ){
		console.log('Nothing');
	}
	else{
		console.log('TBD');
	}
}


DHTClient.prototype.findNodes=function(node){
	dhtc_ll.sendFindNodeRequest(this.udp, this.nid, node.nid, {address: node.ip, port: node.port});
	
	
}

DHTClient.prototype.findNodes2=function(node){
//	console.log(node);
	if( (node.port<=0) || (node.port>=65536) ){
		console.log("port error %d", node.port);
		return ;
	}
	//dhtc_ll.sendFindNodeRequest(this.udp, this.nid, node.nid, {address: node.ip, port: node.port});
	dhtc_ll.sendFindNodeRequest(this.udp, genNeighborID(node.nid, this.nid), randomID(), {address: node.ip, port: node.port});
	//**IMPORTANT 1**:  Here, Must do that, otherwise response a lot of error.
}


DHTClient.prototype.handleTimed=function(){
	this.findNodeFromStartNodes(startupNodes);
	this.findNodeFromQueryNodes();
}


DHTClient.prototype.onUdpMessage=function(msg, rinfo){  
	try {
		msg=dhtc_ll.decodeMsg(msg);
	}catch (err) {
    	console.log("msg decode err, drop it");
    	return ;
	}
	this.handleMsg(new NodeInfo(rinfo.address, rinfo.port),msg);
}

DHTClient.prototype.onUdpError=function(error){
	console.log("utp error");
	console.log(error);
}

DHTClient.prototype.udpHandlerTable={
"listening":  	DHTClient.prototype.onUdpListen,
"message":   	DHTClient.prototype.onUdpMessage.bind(dhtc),
"error":  		DHTClient.prototype.onUdpError
};


DHTClient.prototype.pingNode=function( node ){
	dhtc_ll.sendPingRequest(this.udp,this.nid,node);
}

DHTClient.prototype.findNodeFromQueryNodes=function(){
//	console.log("len=%d", this.table.q.length);
	this.table.q.forEach(this.findNodes2.bind(this));
	this.table.clear();
}

DHTClient.prototype.findNodeFromStartNodes=function(startupNodes){
	startupNodes.forEach( this.findNodes.bind(this) );   
}


DHTClient.prototype.init=function(port){
	this.port=port;
	this.udp = dhtc_ll.create_udp(this.port);
	dhtc_ll.register_handler(this.udp, this.udpHandlerTable);	
};

DHTClient.prototype.start=function(){
	this.findNodeFromStartNodes(startupNodes);
};

DHTClient.prototype.mainLoop=function(error){
	console.log("mainLoop");
	this.tvTimed=setInterval(this.handleTimed.bind(this), 1000);
}

dhtc.init(8079);
dhtc.start();
dhtc.mainLoop();




