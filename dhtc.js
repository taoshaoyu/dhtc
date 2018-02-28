dhtc_ll=require("./dhtc_ll.js");
crypto = require('crypto');
require('./ninfo');


var randomID = function() {
    return crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();
};

/* 
DHTClient: 
member:
udp socket :
router table : 
method:
init()	 :  
start()  :  
stop()   :
pause()  :
*/ 

var BOOTSTRAP_NODES = [
     ['router.bittorrent.com', 6881]
    ,['dht.transmissionbt.com', 6881]
];

var startupNodesInfo=[   //{ip:'router.bittorrent.com', port:6881},
		//{ip:'dht.transmissionbt.com', port:6881},
		{ip:'87.98.162.88',port:6881}
	];


function DHTClient(){
	this.nid=randomID();    //FIXME: nid is fixed or not ? If I restart app, nid is changed? 
							// Do I need to save nid in a configuration ?
	this.q = new NodeInfoList(2000);
};


dhtc=new DHTClient;

DHTClient.prototype.onUdpListen=function(){
//	console.log("---utp listen");
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
		 // &&(node.state=='pinged')){	
		if( (! node.state) || (node.state != 'pinged') ){
			console.log("++++++++++OMG+++++++");
			console.log(node);
			process.exit(1);
			return ;
		}
		nodelistFromResp=dhtc_ll.decodeNodes(msg.r.nodes);
		//console.log(nodelistFromResp);
		nodeList=parseNodeInfoFromRespList(nodelistFromResp);
/*		FIXME: here , need to check whether there are dup node
		for( i=0; i<nodeList.length; i++)
			this.q.append(nodeList[i]);
*/		
		addValues=this.q.addNotes(nodeList);
		//console.log("find_node<==[%s][%s], +%d",node.ip, node.port, addValues);
		return ;
	}else if( (msg.y=='q')  ){		//FIXME: node query me ??? not implemented
		//console.log("Query<=== and q=%s", msg.q);
		if( msg.q == 'get_peers'){
			console.log('get_peers');
		}else if(msg.q == 'announce_peer'){
			console.log('announce_peer');
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
//	FIXME: maybe now I need to add a new state to indecate that I have sent 'find_nodes' to this node.
}

DHTClient.prototype.handlerNodesByTimer=function(node){
	if( node.state=='pinged'){
		this.findNodes(node);
	}
	if( node.state=="waitPing"){
		this.pingNode({ip:node.ip, port:node.port});    //FIXME: need to return a new NodeInfo??
	}
}

DHTClient.prototype.handleTimed=function(){
	for (node of this.q.l){
		this.handlerNodesByTimer(node);  
	}

}


DHTClient.prototype.onUdpMessage=function(msg, rinfo){  
//	console.log("<--utp message:[%s]", rinfo.address);						
//	console.log(rinfo);
	msg=dhtc_ll.decodeMsg(msg);
//	dhtc_ll.printKRPC(msg);
/*
	index= this.q.findNode( new NodeInfo(rinfo.address, rinfo.port) );
	newNode = this.handleMsg( this.q.getNode(index) , msg );
	this.q.updateNode( index, newNode );	
*/
	index= this.q.findNode( new NodeInfo(rinfo.address, rinfo.port) );
	if( index !=-1 )
		this.handleMsg( this.q.getNode(index) , msg );

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
	this.tvTimed=setInterval(this.handleTimed.bind(this), 500);
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


