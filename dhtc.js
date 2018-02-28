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
	this.q = new NodeInfoList(100);
};


dhtc=new DHTClient;

DHTClient.prototype.onUdpListen=function(){
//	console.log("---utp listen");
}

DHTClient.prototype.handleMsg=function(node, msg){
	if( (msg.y=='r') && (msg.r) && (! msg.r.nodes) ){    // resp for 'ping'
	    if(node.state=='waitPing') {     
			console.log("ping<==[%s][%s]",node.ip, node.port);
			node.nid=msg.r.id;
			node.state='pinged'
			return ;
		}else{     // ping response has received and resp again, drop it
			return;  
		}
	}else if((msg.y=='r') && (msg.r) && (msg.r.nodes) &&(node.state=='pinged')){	//resp for 'find_node'
		console.log("find_node<==[%s][%s]",node.ip, node.port);
		nodelistFromResp=dhtc_ll.decodeNodes(msg.r.nodes);
		//console.log(nodelistFromResp);
		nodeList=parseNodeInfoFromRespList(nodelistFromResp);
		//console.log(nodeList);
		for( i=0; i<nodeList.length; i++)
			this.q.append(nodeList[i]);
		return ;
	}else if( (msg.y='q')  ){
		//FIXME: node query me ??? not implemented
		//console.log("Query<===");
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
	console.log("findNodes==>[%s][%s]",node.ip, node.port);
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
//	console.log("timed");
//	this.q.forEach( (node,index) => {
//		this.handlerNodesByTimer(node);     //No need to update queue here, pingNode / findNodes will 
//	} );
	for (node of this.q.l){
		this.handlerNodesByTimer(node);  
	}

}


//FIXME: here need to rewrite
//  'find_node' will return more than 1 node, can not use updateNode 
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
	console.log("ping==>[%s][%s]", rinfo.ip, rinfo.port);
//	console.log(this);
	dhtc_ll.sendPingRequest( this.udp, this.nid, {address: rinfo.ip, port: rinfo.port} );
//	this.q.append(new NodeInfo(rinfo.ip, rinfo.port, 0, 'waitPing'));
	newNode = new NodeInfo(rinfo.ip, rinfo.port, 0, 'waitPing');
	index=this.q.findNode(newNode);
	if(  index== -1 )
		this.q.append(newNode);
	else{
		node=L.nth(index,this.q.l);
		node.pingRetry--;
		if(node.pingRetry==0){
			// FIXME: to debug it
			this.q.delete(index);
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
//	setInterval(this.handleTimed.bind(this), 10000);
}




dhtc.init({addr:"0.0.0.0",port:7888});
dhtc.start();
dhtc.mainLoop();


dd=function(){
	dhtc.q.dumpNodeInfoList();
}

p=function(n){
	dhtc.pingNode((L.nth(n,dhtc.q.l)))
}

fd=function (n) {
	dhtc.findNodes((L.nth(n,dhtc.q.l)))
}


