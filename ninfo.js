
L=require('list');

/*
*/
NodeInfo=function(ip, port, nid, state){
	this.ip=ip;
	this.port=port;
	this.nid=nid;
	this.state=state;
	this.pingRetry=10;
	this.findNodeRetry=10;
}

NodeInfo.prototype.compare=function(rinfo){
/*
	console.log("==cmp: this");
	console.log(this);
	console.log("==cmp: rinfo");
	console.log(rinfo);
*/
//	return (this.ip == rinfo.ip) && (this.port == rinfo.port);
	return (this.ip == rinfo.ip) ;
}

parseNodeInfoFromRespList=function(respList){
	retList=[];
	for( i=0;i<respList.length;i++ ){
		//console.log(retList);
		ni = new NodeInfo(respList[i].address, respList[i].port, respList[i].nid, 'waitPing');
		found = false;
		for( j=0; j<retList.length; j++){
			//console.log("j = %d===",j);
			//console.log(retList[j]);
			if( ni.compare( retList[j] ) ){
				found=true;
				break;
			}
		}
		if( ! found )
			retList.push(ni);
		
	}
	return retList;
}


NodeInfoList=function(maxSize){
	console.log("++ NodeInfoList init ++");
	this.l=L.empty();
	this.maxSize=maxSize;
}

NodeInfoList.prototype.append=function(node){
//	console.log("++ append ++");
	if(this.l.length==this.maxSize){
		//FIXME: drop it ??
		return;	
	}
	this.l = L.append(node, this.l);
}


//FIXME: TBD
NodeInfoList.prototype.delete=function(index){
	this.l = L.remove(index,1,this.l);
}


/*
return index of rinfo,-1 if not found
*/
NodeInfoList.prototype.findNode=function( rinfo ){
	for( e of this.l ){
//		console.log(e);
		if( e.compare(rinfo) ){
			return L.indexOf(e, this.l);
		}
	}
	return -1;
}

NodeInfoList.prototype.updateNode=function( index, newNode ){
	this.l = L.update(index, newNode, this.l);
}

NodeInfoList.prototype.getNode=function( index){
	return L.nth(index, this.l)
}

NodeInfoList.prototype.dumpNodeInfoList=function( ){
	console.log("++dump NondInfo: length=%d", this.l.length);
	for( e of this.l){
		console.log(e);
	}
	console.log("--");
}




//module.NodeInfoList = ninfo;
exports.NodeInfo=NodeInfo;
exports.NodeInfoList=NodeInfoList;

