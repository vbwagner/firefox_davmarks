const filename = "bookmarks.json";
var dictOldIDsToNewIDs = { "-1": "-1" };

checkSettings();
init();
browser.browserAction.onClicked.addListener(openSettings);
browser.bookmarks.onCreated.addListener(onCreatedCheck);
browser.bookmarks.onRemoved.addListener(onRemovedCheck);
browser.bookmarks.onChanged.addListener(onChangedCheck)
browser.notifications.onClicked.addListener(notificationSettings)

function init() {
	let getting = browser.storage.local.get();
	getting.then( (option) => {
		let start = option.s_startup || false;
		if( start === true ) {
			getDAVMarks();
		}
	});
}

function notificationSettings(id) {
	if(id == 'setting') {
		openSettings();
	}
}

function openSettings() {
	browser.runtime.openOptionsPage();
}

function checkSettings() {
	var getting = browser.storage.local.get();
	getting.then(onGot, onError);
}

function notify(notid, message) {
	browser.notifications.create(notid, {
		"type": "basic",
		"title": "DAVMarks",
		"iconUrl": "icons/bookmark.png",
		"message": message
	});
}

function onCreatedCheck() {
	checkSettings();
	if(s_create === true) {
		saveMarks();
	}
}

function onChangedCheck() {
	checkSettings();
	if(s_change === true) {
		saveMarks();
	}
}

function onRemovedCheck() {
	checkSettings();
	if(s_remove === true) {
		browser.bookmarks.onRemoved.removeListener(onRemovedCheck);
		saveMarks();
	}
}

function saveMarks() {
	var gettingTree = browser.bookmarks.getTree();
	gettingTree.then(saveDAVMarks, onRejected);
	
	let datems = Date.now();
	let date = new Date(datems);
	let doptions = { weekday: 'long',  hour: '2-digit', minute: '2-digit' };
	browser.storage.local.set({
		last_s: datems,
	});
	
	browser.browserAction.setTitle({title: "DAVMarks: " + date.toLocaleDateString(navigator.language,doptions)});
}

function onRejected(error) {
  notify('error', 'An error: ${error}');
}

function saveDAVMarks(bookmarkItems) {
	browser.bookmarks.onRemoved.removeListener(onRemovedCheck);
	var getting = browser.storage.local.get();
	getting.then(onGot, onError);

	var bookmarks = JSON.stringify(bookmarkItems);
	var xhr = new XMLHttpRequest();
	xhr.open("PUT", davurl + "/" + filename, true, user, pw);
	
	xhr.withCredentials = true;
	xhr.setRequestHeader('X-Filename', filename);
	
	xhr.onload = function () {
		if( xhr.status < 200 || xhr.status > 226) {
			notify('error','There was some error saving the bookmarks. The status response is: ' + xhr.status);
			browser.bookmarks.onRemoved.addListener(onRemovedCheck);
		}
	}
	xhr.send(bookmarks);
}

function getDAVMarks() {
	checkSettings();

	var xhr = new XMLHttpRequest();
	xhr.open('GET', davurl + '/' + filename + '?t=' + Math.random(), true, user, pw);
	
	xhr.withCredentials = true;
	xhr.setRequestHeader('X-Filename', filename);
	
	xhr.onload = function () {		
		if( xhr.status != 200 ) {
			notify('error','There was a error retrieving the bookmarks from the server. The status response is: ' + xhr.status);
		}
		else {
			let DAVMarks = JSON.parse(xhr.responseText);
			browser.bookmarks.onCreated.removeListener(onCreatedCheck);
			browser.bookmarks.onRemoved.removeListener(onRemovedCheck);
			pMarks = [];
			let parsedMarks = parseMarks(DAVMarks, index=0);
			count = 0;
			addAllMarks(parsedMarks);			
		}
	}
	xhr.send();
}

function parseMarks(DAVMarks, level=0) {
	pMarks.push(DAVMarks[level]);
	let findex = 0;
	if(DAVMarks[level].children) {
		DAVMarks[level].children.forEach(function() {
			parseMarks(DAVMarks[level].children, findex)
			findex++;
		});
	}
	return pMarks;
}

function removeAllMarks() {
	browser.bookmarks.onRemoved.removeListener(onRemovedCheck);
	browser.bookmarks.getTree().then(function(tree) {
		tree[0].children.forEach(function(mainfolder) {
			mainfolder.children.forEach(function(userfolder) {
				browser.bookmarks.removeTree(userfolder.id);
			});
		});
	});
	browser.bookmarks.onRemoved.addListener(onRemovedCheck);
	browser.storage.local.set({
		last_s: 1,
	});
}

function addAllMarks(parsedMarks, index=1) {
	browser.bookmarks.onCreated.removeListener(onCreatedCheck);
    let bmid = parsedMarks[index].id;
    let bmparentId = parsedMarks[index].parentId;
    let bmindex = parsedMarks[index].index;
    let bmtitle = parsedMarks[index].title;
    let bmtype = parsedMarks[index].type;
    let bmurl = parsedMarks[index].url;
	let bmdate = parsedMarks[index].dateAdded;
    let newParentId = (typeof bmparentId !== 'undefined' && bmparentId.substr(bmparentId.length - 2) == "__") ? bmparentId : dictOldIDsToNewIDs[bmparentId];
	
	if(bmparentId == "root________" || bmdate < last_s) {
		addAllMarks(parsedMarks, ++index);
		return false;
	}
	
	browser.bookmarks.create(
		(bmtype == "separator" ?
		 {
			 index: bmindex,
			 parentId: newParentId,
			 type: bmtype
		 } :
		 (bmtype == "folder" ?
		  {
			  index: bmindex,
			  parentId: newParentId,
			  title: bmtitle,
			  type: bmtype
		  } :
		  {
			  index: bmindex,
			  parentId: newParentId,
			  title: bmtitle,
			  type: bmtype,
			  url: bmurl
		  }
		 )
		)
	).then(function(node) {
		let newID = bmid.substr(bmid.length - 2) == "__" ? bmid : node.id;
		dictOldIDsToNewIDs[bmid] = newID;
		++count;

		if (typeof parsedMarks[index+1] !== 'undefined') {
			addAllMarks(parsedMarks, ++index);
			
		}
		else {
			notify('info','Imported ' + count + ' bookmarks/folders.');
			browser.bookmarks.onCreated.addListener(onCreatedCheck);
			browser.bookmarks.onRemoved.addListener(onRemovedCheck);
			
			let datems = Date.now();
			let date = new Date(datems);
			let doptions = { weekday: 'long',  hour: '2-digit', minute: '2-digit' };
			browser.storage.local.set({
				last_s: datems,
			});
			browser.browserAction.setTitle({title: "DAVMarks: " + date.toLocaleDateString(navigator.language,doptions)});
		}
	}, function(err) {
		notify('error', 'There was a error importing the bookmark \"' + bmtitle + ' (' + bmurl + ')\".');
	});
}

function onError(error) {
	notify('error', 'Error: ${error}');
}

function onGot(item) {
	s_startup = item.s_startup || false;
	s_create = item.s_create || false;
	s_remove = item.s_remove || false;
	s_change = item.s_change || false;
	last_s = item.last_s || 0;
	
	davurl = item.wdurl || "";
	user = item.user || "";
	pw = item.password || "";
	
	if(davurl.length <= 0 || user.length <= 0 || pw.length <= 0) {
		notify('setting', 'You should configure url, user and password in the options of DAVMarks, so that the AddOn can process the bookmarks.');
	}
}
