
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
//	console.log("-->sendKRPC");
//	console.log(rinfo);
//	console.log(msg);
	var buf = bencode.encode(msg);
    udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
}

printKRPC=function(msg){
    console.log("{ ");
    for(v in msg){
        if( v=='r'){
            console.log("r :{");
            for( k in msg[v]){
                console.log(k+":"+msg[v][k].toString('hex'));
            }
            console.log("}");
        }
        else if( v!='v')
            console.log(v+" : "+msg[v].toString('ascii'));

    }
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

decodeNodes = function(data) {
    var nodes = [];
    for (var i = 0; i + 26 <= data.length; i += 26) {
        nodes.push({
            nid: data.slice(i, i + 20),
            address: data[i + 20] + '.' + data[i + 21] + '.' +
                data[i + 22] + '.' + data[i + 23],
            port: data.readUInt16BE(i + 24)
        });
    }
    return nodes;
};

exports.create_udp = create_udp;
exports.register_handler = register_handler;
exports.sendFindNodeRequest = sendFindNodeRequest;
exports.sendPingRequest = sendPingRequest;
exports.decodeMsg = decodeMsg;
exports.printKRPC = printKRPC;
exports.decodeNodes = decodeNodes;