const filename = "bookmarks_chrome.json";
var dictOldIDsToNewIDs = { "-1": "-1" };

init();
chrome.browserAction.onClicked.addListener(openSettings);
chrome.bookmarks.onCreated.addListener(onCreatedCheck);
chrome.bookmarks.onRemoved.addListener(onRemovedCheck);
chrome.bookmarks.onChanged.addListener(onChangedCheck)
chrome.notifications.onClicked.addListener(notificationSettings)

function init() {
	chrome.storage.local.get('s_startup', function (result) {
		s_startup = result.s_startup || false;
		if(s_startup === true) {
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
	chrome.runtime.openOptionsPage();
}

function notify(notid, message) {
	chrome.notifications.create(notid, {
		"type": "basic",
		"title": "DAVMarks",
		"iconUrl": "icons/bookmark.png",
		"message": message
	});
}

function onCreatedCheck() {
	chrome.storage.local.get('s_create', function (result) {
		s_create = result.s_create || false;
		if(s_create === true) {
			saveMarks();
		}
	});
}

function onChangedCheck() {
	chrome.storage.local.get('s_change', function (result) {
		s_change = result.s_change || false;
		if(s_change === true) {
			saveMarks();
		}
	});
}

function onRemovedCheck() {
	chrome.storage.local.get('s_remove', function (result) {
        s_remove = result.s_remove || false;
		if(s_remove === true) {
			chrome.bookmarks.onRemoved.removeListener(onRemovedCheck);
			saveMarks();
		}
    });
	
}

function saveMarks() {
	chrome.bookmarks.getTree(saveDAVMarks);
	
	let datems = Date.now();
	let date = new Date(datems);
	let doptions = { weekday: 'long',  hour: '2-digit', minute: '2-digit' };
	chrome.storage.local.set({
		last_s: datems,
	});
	
	chrome.browserAction.setTitle({title: "DAVMarks: " + date.toLocaleDateString(navigator.language,doptions)});
}

function saveDAVMarks(bookmarkItems) {
	chrome.bookmarks.onRemoved.removeListener(onRemovedCheck);
	
	chrome.storage.local.get(['wdurl','user','password'], function(optionv) {
		let davurl = optionv.wdurl || "";
		let user = optionv.user || "";
		let pw = optionv.password || "";

		var bookmarks = JSON.stringify(bookmarkItems);
		var xhr = new XMLHttpRequest();
		xhr.open("PUT", davurl + "/" + filename, true);
		
		xhr.withCredentials = true;
		xhr.setRequestHeader('X-Filename', filename);
		xhr.setRequestHeader("Authorization", 'Basic ' + btoa(user + ":" + pw));
		
		xhr.onload = function () {
			if( xhr.status < 200 || xhr.status > 226) {
				notify('error','There was some error saving the bookmarks. The status response is: ' + xhr.status);
				chrome.bookmarks.onRemoved.addListener(onRemovedCheck);
			}
		}
		xhr.send(bookmarks);
	});
}

function getDAVMarks() {
	chrome.storage.local.get(['wdurl','user','password'], function(optionv) {
		let davurl = optionv.wdurl || "";
		let user = optionv.user || "";
		let pw = optionv.password || "";
		
		var xhr = new XMLHttpRequest();
		xhr.open('GET', davurl + '/' + filename + '?t=' + Math.random(), true);
		
		xhr.withCredentials = true;
		xhr.setRequestHeader('X-Filename', filename);
		xhr.setRequestHeader("Authorization", 'Basic ' + btoa(user + ":" + pw));
		
		xhr.onload = function () {		
			if( xhr.status != 200 ) {
				notify('error','There was a error retrieving the bookmarks from the server. The status response is: ' + xhr.status);
			}
			else {
				let DAVMarks = JSON.parse(xhr.responseText);
				chrome.bookmarks.onCreated.removeListener(onCreatedCheck);
				chrome.bookmarks.onRemoved.removeListener(onRemovedCheck);
				pMarks = [];
				let parsedMarks = parseMarks(DAVMarks, 0);
				count = 0;
				addAllMarks(parsedMarks, 1);			
			}
		}
		xhr.send();
	});
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
	chrome.bookmarks.onRemoved.removeListener(onRemovedCheck);
	chrome.bookmarks.getTree(function(tree) {
		tree[0].children.forEach(function(mainfolder) {
			mainfolder.children.forEach(function(userfolder) {
				chrome.bookmarks.removeTree(userfolder.id);
			});
		});
	});
	
	chrome.storage.local.set({
		last_s: 1,
	});
}

function addAllMarks(parsedMarks, index) {
	chrome.bookmarks.onCreated.removeListener(onCreatedCheck);
    let bmid = parsedMarks[index].id;
    let bmparentId = parsedMarks[index].parentId;
    let bmindex = parsedMarks[index].index;
    let bmtitle = parsedMarks[index].title;
	let bmtype = "";
	
	if(("url" in parsedMarks[index])) {
		bmtype = "bookmark";
	}
	else {
		bmtype = "folder";
	}
	
    let bmurl = parsedMarks[index].url;
	let bmdate = parsedMarks[index].dateAdded;
	let newParentId = (typeof bmparentId !== 'undefined' && bmparentId.length === 1 ) ? bmparentId : dictOldIDsToNewIDs[bmparentId];

	if(bmparentId == "0") {
		addAllMarks(parsedMarks, ++index);
		return false;
	}
	
	chrome.bookmarks.create(
		(bmtype == "separator" ?
		 {
			 index: bmindex,
			 parentId: newParentId,
		 } :
		 (bmtype == "folder" ?
		  {
			  index: bmindex,
			  parentId: newParentId,
			  title: bmtitle,
		  } :
		  {
			  index: bmindex,
			  parentId: newParentId,
			  title: bmtitle,
			  url: bmurl
		  }
		 )
		), function(newBookmark) {
			let newID = bmid.length == 1 ? bmid : newBookmark.id;
			dictOldIDsToNewIDs[bmid] = newID;
			++count;
			
			if (typeof parsedMarks[index+1] !== 'undefined') {
				addAllMarks(parsedMarks, ++index);
			}
			else {
				notify('info','Imported ' + count + ' bookmarks/folders.');
				chrome.bookmarks.onCreated.addListener(onCreatedCheck);
				chrome.bookmarks.onRemoved.addListener(onRemovedCheck);
				
				let datems = Date.now();
				let date = new Date(datems);
				let doptions = { weekday: 'long',  hour: '2-digit', minute: '2-digit' };
				chrome.storage.local.set({
					last_s: datems,
				});
				chrome.browserAction.setTitle({title: "DAVMarks: " + date.toLocaleDateString(navigator.language,doptions)});
			}
		});
}
