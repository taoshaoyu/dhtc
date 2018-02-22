dhtc_ll=require("./dhtc_ll.js");
crypto = require('crypto');


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
/*
   ,['67.215.246.10', 6881]
   ,['router.bittorrent.com', 6969]
   ,['tracker.btba.cc',6060]
   ,['tracker.coppersurfer.tk',6969]
   ,['tracker.leechers-paradise.org',6969]
*/
    ,['dht.transmissionbt.com', 6881]
];


function DHTClient(){
	this.nid=randomID();    //FIXME: nid is fixed or not ? If I restart app, nid is changed? 
							// Do I need to save nid in a configuration ?
};

DHTClient.prototype.onUdpListen=function(){
	console.log("---utp listen");
}

DHTClient.prototype.onUdpMessage=function(msg, rinfo){
	console.log("<--utp message");
	console.log(rinfo);
	msg=dhtc_ll.decodeMsg(msg);
	if(msg.t=='taos')
	{
		console.log("taosy");
	}
	console.log(msg);
}

DHTClient.prototype.onUdpError=function(error){
	console.log("utp error");
	console.log(error);
}

DHTClient.prototype.udpHandlerTable={
"listening":  	DHTClient.prototype.onUdpListen,
"message":   	DHTClient.prototype.onUdpMessage,
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
	console.log("+DHTClient start, start timer");
	setInterval(function() {
//		this.pingDHTNetwork();
        this.joinDHTNetwork();
    //    this.makeNeighbours();
    }.bind(this), 3000);
};


DHTClient.prototype.mainLoop=function(error){
	console.log("mainLoop");
}

dhtc=new DHTClient;
dhtc.init({addr:"0.0.0.0",port:7888});
dhtc.start();
dhtc.mainLoop();