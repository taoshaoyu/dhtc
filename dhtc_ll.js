
var bencode=require("bencode");
dgram=require("dgram");



create_udp=function(port){
 	udp=dgram.createSocket('udp4');
 	udp.bind(port);
 	return udp;
}

register_handler=function(udp, handlers){
	for (v in handlers){
		udp.on(v,handlers[v]);
	}
}

decodeMsg=function(msg){
	return bencode.decode(msg);
}


sendKRPC=function(udp,msg,rinfo){
	console.log("-->sendKRPC");
	console.log(rinfo);
	console.log(msg);
	var buf = bencode.encode(msg);
    udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
}


sendPingRequest=function(udp,nid,target_rinfo){
	var msg = {t: "taos",y: 'q', q: 'ping', a: {id: nid,}};
    sendKRPC(udp,msg,target_rinfo);
}

sendFindNodeRequest=function(udp, nid, targetId, rinfo){
    var msg = {t: "taos", y: 'q', q: 'find_node',
        a: {id: nid, target: targetId} };
    sendKRPC(udp, msg, rinfo);
}


exports.create_udp = create_udp;
exports.register_handler = register_handler;
exports.sendFindNodeRequest = sendFindNodeRequest;
exports.sendPingRequest = sendPingRequest;
exports.decodeMsg = decodeMsg;