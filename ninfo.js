
L=require('list');

/*
*/
NodeInfo=function(ip, port, nid, state){
	this.ip=ip;
	this.port=port;
	this.nid=nid;
	this.state=state;
	this.pingRetry=5;
	this.findNodeRetry=30;
	this.score=120;
}

NodeInfo.prototype.compare=function(rinfo){
	return (this.ip == rinfo.ip) ;
}

NodeInfo.prototype.nodeCopy=function(node){
	this.ip=node.ip;
	this.port=node.port;
	this.nid=node.nid;
	this.state=node.state;
	this.pingRetry=node.pingRetry;
	this.findNodeRetry=node.findNodeRetry;
}

NodeInfo.prototype.dumpSelf=function(){
	console.log("ip=%s", this.ip);
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
	this.deletedCount=0;
}

NodeInfoList.prototype.append=function(node){
//	console.log("++ append ++");
	found=false;
	if( this.deletedCount > 0){   // there are 'delete' record, replace it.
		for( index=0; index<this.l.length; index++){
			oldNode=L.nth(index,this.l);
			if(oldNode.state == 'deleted'){  //found 
				found=true;
				oldNode.nodeCopy(node);   //replace 
				this.deletedCount --;
				break;
			}
		}
		if(! found){
			console.log("Impossible...");
			proess.exit(1);
		}
	}else{
		if(this.l.length==this.maxSize){
			//FIXME: drop it ??
			return;	
		}
		this.l = L.append(node, this.l);
	}
}

//There is a bug here related with List's sync
//If delete(a) -> delete(a) again, this.l is not ready for secode delete.
//So there is a 'undefined' in the list
//OMG, maybe I should use other package instend of package 'List'
//Now I just mark this NodeInfo as 'deleted', but this element is still in the queue
NodeInfoList.prototype.delete=function(index){
	//console.log("  ===> delete %d", index);
	//this.l = L.remove(index,1,this.l);
	L.nth(index,this.l).state='deleted';
	this.deletedCount++;
}


//return value: n: 
NodeInfoList.prototype.addNotes = function( nodeList ){
	found=false;
	count=0;
	for( i=0; i<nodeList.length; i++){
		for( j=0; j<this.l.length; j++){
			if( L.nth(j,this.l).compare(nodeList[i])){
				found=true;
				break;
			}
		}
		if(! found){
			this.append(nodeList[i]);
			count++;
		}
	}
	return count;
}

/*
return index of rinfo,-1 if not found
*/
NodeInfoList.prototype.findNode=function( rinfo ){
//	console.log("++ findNode dump NondInfo: length=%d", this.l.length);
	for( e of this.l ){
		try{
	//		console.log(e);
			if( e.compare(rinfo) ){
				return L.indexOf(e, this.l);
			}
		}catch(err){
			this.dumpNodeInfoList(0);
			console.log(err);
			process.exit(1);
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

NodeInfoList.prototype.dumpNodeInfoList=function( simpleOrNot ){
//	console.log("  ++dump NondInfo List: length=%d", this.l.length);
/*
	var deletedNotesCount=0;
	for( i=0; i<this.l.length; i++){
		if(L.nth(i,this.l).state == 'deleted')
			deletedNotesCount++;
	}
*/
	if( simpleOrNot == 0){
		for( i=0; i<this.l.length; i++){
			console.log("[%d]: %s , %s", i, L.nth(i,this.l).ip, L.nth(i,this.l).state);
		}
	}
//	console.log("  ++dump length=%d deleted=%d", this.l.length, this.deletedCount);
}

NodeInfoList.prototype.sanCheck=function(){
	for(i=0;i<this.l.length;i++){
		if (!L.nth(i, this.l)){
			console.log("  sanCheck Error    i=%d",i);
			process.exit();
		}
	}
}


//module.NodeInfoList = ninfo;
exports.NodeInfo=NodeInfo;
exports.NodeInfoList=NodeInfoList;

