dhtc_ll=require("./dhtc_ll.js");
crypto = require('crypto');
require('./ninfo');


var genNeighborID = function(target, nid) {
    return  Buffer.concat([target.slice(0, 10), nid.slice(10)]);
}

var randomID = function() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
};

var BOOTSTRAP_NODES = [
     ['router.bittorrent.com', 6881]
    ,['dht.transmissionbt.com', 6881]
];

var startupNodesInfo=[   
		{ip:'router.bittorrent.com', port:6881},
		{ip:'dht.transmissionbt.com', port:6881},
		{ip:'87.98.162.88',port:6881},
		{ip:'41.75.78.113', port:6881}
	];



function DHTClient(){
	this.nid=randomID();    //FIXME: nid is fixed or not ? If I restart app, nid is changed? 
							// Do I need to save nid in a configuration ?
	this.q = new NodeInfoList(200);
};


dhtc=new DHTClient;

DHTClient.prototype.onUdpListen=function(){
//	console.log("---utp listen");
}


DHTClient.prototype.onAnnouncePeerRequest = function(msg, rinfo) {
	console.log('onAnnouncePeerRequest');
//	console.log(rinfo.address);
	if( msg.a.name)
		console.log(msg.a.name.toString());
    var port;
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
    //    return;
    }

    if (msg.a.implied_port != undefined && msg.a.implied_port != 0) {
        port = rinfo.port;
    }
    else {
        port = msg.a.port || 0;
    }

    if (port >= 65536 || port <= 0) {
        return;
    }
dhtc_ll.sendAnnouncepeerResponse(this.udp, tid, genNeighborID(nid, this.nid), rinfo);
//dhtc_ll.sendAnnouncepeerResponse(this.udp, tid, this.nid, rinfo);
    console.log("magnet:?xt=urn:btih:%s from %s:%s", infohash.toString("hex"), rinfo.address, rinfo.port);
};

DHTClient.prototype.onGetPeersRequest = function(node,msg) {
//    console.log("+++ +onGetPeersRequest");
//    console.log(node.ip);
//    console.log(msg);
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

//	dhtc_ll.sendGetPeerResponseWithNode(this.udp, tid, nid, token, '', {address: node.ip, port: node.port})
	dhtc_ll.sendGetPeerResponseWithNode(this.udp, genNeighborID(this.nid, tid), nid, token, '', {address: node.ip, port: node.port})
	
};


DHTClient.prototype.onGetPeersRequest2 = function(msg,rinfo) {
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
    	console.log('err');
        return;
    }

	//dhtc_ll.sendGetPeerResponseWithNode(this.udp, tid, nid, token, '', {address: rinfo.address, port: rinfo.port})
	dhtc_ll.sendGetPeerResponseWithNode(this.udp, genNeighborID(this.nid, tid), nid, token, '', {address: rinfo.ip, port: rinfo.port})
	
};

DHTClient.prototype.handleMsgNoRecorded=function(msg, rinfo){
	if( (msg.y=='r') && (msg.r) && (! msg.r.nodes) ){    // resp for 'ping'
	    //console.log("??? resp for ping");
	}else if((msg.y=='r') && (msg.r) && (msg.r.nodes)){  //resp for 'find_node'
		//console.log("??? resp for find_node");
	}else if( (msg.y=='q')  ){		//FIXME: node query me ??? not implemented
		if( msg.q == 'get_peers'){
			//console.log('??? get_peers');
			this.onGetPeersRequest2(msg,rinfo);
		}else if(msg.q == 'announce_peer'){
			this.onAnnouncePeerRequest(msg, rinfo);
			return;
		}else if(msg.q == 'ping'){
			//console.log('??? ping');
			return ;
		}else if(msg.q == 'find_node'){
			//console.log('??? find_node');
			dhtc_ll.sendFindNodeResponse(this.udp, msg.t, this.nid, {}, {address: rinfo.ip, port: rinfo.port})
			return ;
		}
		else{
			console.log('what is it??');
			console.log(msg);
		}
		return ;
	}else if((msg.y=='e')){			
		console.log('??? error');
	}else if((!msg.y) && (!msg.t) &&(!msg.q) ){
		console.log('??? only version');
		return ;
	}
	else{
		console.log("???TBD=====");
		console.log(node);
		console.log(msg);
		return;
	}
}

DHTClient.prototype.handleMsg=function(node, msg){
	if( (msg.y=='r') && (msg.r) && (! msg.r.nodes) ){    // resp for 'ping'
	//	console.log(msg);
	    if(node.state=='waitPing') {     
			//console.log("ping<==[%s][%s]",node.ip, node.port);
			node.nid=msg.r.id;
			node.state='pinged'
			return ;
		}else{     // ping response has received and resp again, drop it
			return;  
		}
	}else if((msg.y=='r') && (msg.r) && (msg.r.nodes)){  //resp for 'find_node'
		if( (! node.state) || (node.state != 'pinged') ){
			console.log("++++++++++OMG+++++++");
			console.log(node);
			return ;
		}
		nodelistFromResp=dhtc_ll.decodeNodes(msg.r.nodes);

		if(nodelistFromResp.length > 0){
			node.score += 3;
			nodeList=parseNodeInfoFromRespList(nodelistFromResp);
			addValues=this.q.addNotes(nodeList);   // If node has been in queue, ignore it
			if( addValues ==0 ){
			//	console.log("+0 nodes??, lenof(nodelistFromResp) is %d", nodelistFromResp.length);
			}
			return ;
		}else{
			node.score -= 1;
			if(node.score <=0 ){
				//FIXME: how to let queue to delete me ????
				//Or don't delete this node here,just sub score and let timer to check it?
			}
		}
	}else if( (msg.y=='q')  ){		//FIXME: node query me ??? not implemented
		//console.log("Query<=== and q=%s", msg.q);
		if( msg.q == 'get_peers'){
			//console.log('get_peers');
			this.onGetPeersRequest(node,msg);
		}else if(msg.q == 'announce_peer'){
			console.log('announce_peer');
			console.log(node.ip);
			console.log(msg);
		}else if(msg.q == 'ping'){
		//	console.log('resp ping ==> %s', node.ip);
			dhtc_ll.sendPingResponse(this.udp, msg.t, this.nid, {address: node.ip, port: node.port}) 
			return ;
		}else if(msg.q == 'find_node'){
/*			// TBD, I don't know how to reply nodes' find_node , ignore it now
			targetIDList=[];
			targetIDList.push()
			dhtc_ll.sendFindNodeResponse(this.udp, msg.t, this.nid, targetIDList, {address: node.ip, port: node.port}) // TBD
*/		
		//	console.log('resp find_node ==> %s', node.ip);
			dhtc_ll.sendFindNodeResponse(this.udp, msg.t, this.nid, {}, {address: node.ip, port: node.port})
			return ;
		}
		else{
			console.log('what is it??');
			console.log(msg);
		}
		return ;
	}else if((msg.y=='e')){			//FIXME: remote node report an error, how to deal with it??
									//I don't know why one ip will report error repeatly, Should I need to delete this node ?
		//console.log("An Error from:[%s]", node.ip);
		return ;
	}else if((!msg.y) && (!msg.t) &&(!msg.q) ){
		//  Just a msg like "{ v: <Buffer 4c 54 01 01> }"
		// I do not know how to deal with it.So, drop it
		return ;
	}
	else{
		console.log("TBD=====");
		console.log(node);
		console.log(msg);
		return;
	}
}


DHTClient.prototype.findNodes=function(node){
//	console.log("findNodes==>[%s][%s]",node.ip, node.port);
//	console.log(this);
	dhtc_ll.sendFindNodeRequest(this.udp, this.nid, node.nid, {address: node.ip, port: node.port});
//	dhtc_ll.sendFindNodeRequest(this.udp, this.nid, randomID(), {address: node.ip, port: node.port});
}

DHTClient.prototype.handlerNodesByTimer=function(node, index){	
	if( node.state=='pinged'){
		if( node.score <= 0 ){
			//console.log("I will delete this node");
			this.q.delete(index);
		}else{
			this.findNodes(node);
		}
	}
	if( node.state=="waitPing"){
		this.pingNode({ip:node.ip, port:node.port});    //FIXME: need to return a new NodeInfo??
	}
}

DHTClient.prototype.handleTimed=function(){
/*
	for (node of this.q.l){
		this.handlerNodesByTimer(node);  
	}
*/
	for( i=0; i<this.q.l.length; i++){
		this.handlerNodesByTimer(L.nth(i, this.q.l),i);  
	}

}


DHTClient.prototype.onUdpMessage=function(msg, rinfo){  
//	console.log("<--utp message:[%s]", rinfo.address);						
//	console.log(rinfo);
try {
	msg=dhtc_ll.decodeMsg(msg);
}catch (err) {
    console.log("msg decode err, drop it");
    return ;
}
//	dhtc_ll.printKRPC(msg);
/*
	index= this.q.findNode( new NodeInfo(rinfo.address, rinfo.port) );
	newNode = this.handleMsg( this.q.getNode(index) , msg );
	this.q.updateNode( index, newNode );	
*/

	index= this.q.findNode( new NodeInfo(rinfo.address, rinfo.port) );
	if( index !=-1 )
		this.handleMsg( this.q.getNode(index) , msg );
	else{
		this.handleMsgNoRecorded(  msg, rinfo);
	}

//	this.handleMsgNoRecorded(  msg, rinfo);

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

DHTClient.prototype.pingDHTNetwork = function() {
    BOOTSTRAP_NODES.forEach(function(node) {
        dhtc_ll.sendPingRequest(this.udp, this.nid,{address: node[0], port: node[1]});
    }.bind(this));
};

DHTClient.prototype.joinDHTNetwork = function() {
    BOOTSTRAP_NODES.forEach(function(node) {
        dhtc_ll.sendFindNodeRequest(this.udp, this.nid, randomID(), {address: node[0], port: node[1]});
    }.bind(this));
};


DHTClient.prototype.pingNode=function( rinfo ){
//	console.log("ping==>[%s][%s]", rinfo.ip, rinfo.port);
	newNode = new NodeInfo(rinfo.ip, rinfo.port, 0, 'waitPing');
	index=this.q.findNode(newNode);
	if(  index== -1 ){
		dhtc_ll.sendPingRequest( this.udp, this.nid, {address: rinfo.ip, port: rinfo.port} );
		this.q.append(newNode);
	}
	else{
		node=L.nth(index,this.q.l);
		node.pingRetry--;
		if(node.pingRetry==0){
			this.q.delete(index);
		}else if(node.state== 'deleted'){
			console.log("Error: to ping a deleted node");
			console.log(node);
			process.exit(1);
		}else{
			dhtc_ll.sendPingRequest( this.udp, this.nid, {address: rinfo.ip, port: rinfo.port} );
		}
	}
}

DHTClient.prototype.getStartupNodesNidAsync=function(startupNodes){
	console.log(startupNodes);
//	console.log(this);
	startupNodes.forEach( this.pingNode.bind(this) 	);    //FIXME: why must bind??
}


DHTClient.prototype.init=function(option){
	console.log("+DHTClient init");
	this.addr=option.addr;
	this.port=option.port;
	console.log("+DHTClient init, init udp");
	this.udp = dhtc_ll.create_udp(this.port);
	console.log("+DHTClient init, register udp handler");
	dhtc_ll.register_handler(this.udp, this.udpHandlerTable);	
};



DHTClient.prototype.start=function(){
	console.log("+DHTClient start");
	setTimeout(
		this.getStartupNodesNidAsync.bind(this), 1000,    //FIXME: why must bind(this)
		startupNodesInfo
	);
};


DHTClient.prototype.mainLoop=function(error){
	console.log("mainLoop");
	this.tvTimed=setInterval(this.handleTimed.bind(this), 1000);
	this.tvCheckQueue=setInterval(function(){
		this.q.dumpNodeInfoList(1);
		this.q.sanCheck();
	}.bind(this), 5000);
}




dhtc.init({addr:"0.0.0.0",port:8079});
dhtc.start();
dhtc.mainLoop();


dd=function(n){
	dhtc.q.dumpNodeInfoList(n);
}

p=function(n){
	dhtc.pingNode((L.nth(n,dhtc.q.l)))
}

fd=function (n) {
	dhtc.findNodes((L.nth(n,dhtc.q.l)))
}

cd=function(){
	clearTimeout(dhtc.tvTimed);
	clearTimeout(dhtc.tvCheckQueue);
}


