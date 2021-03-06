var background_page = browser.extension.getBackgroundPage();

function checkForm() {
	if(document.getElementById('wdurl').value != '' && document.getElementById('user').value != '' && document.getElementById('password').value != ''){
        document.getElementById('ssubmit').disabled=false;
		document.getElementById('mdownload').disabled=false;
		document.getElementById('mupload').disabled=false;
		document.getElementById('mremove').disabled=false;
    }
	else{
        document.getElementById('ssubmit').disabled=true;
		document.getElementById('mdownload').disabled=true;
		document.getElementById('mupload').disabled=true;
		document.getElementById('mremove').disabled=false;
    }
}

function saveOptions(e) {
	e.preventDefault();
	
	if(typeof last_sync === "undefined" || last_sync.toString().length <= 0) {
		document.getElementById('smessage').innerHTML = "It looks like you haven't used the add-on yet. You can now import any bookmarks saved on the server with <b>\"Import\"</b>. If you have already created bookmarks in your browser, it might be a good idea to delete them with <b>\"Remove\"</b>.";
	}
	
	browser.storage.local.set({
		s_startup: document.querySelector("#s_startup").checked,
		s_create: document.querySelector("#s_create").checked,
		s_remove: document.querySelector("#s_remove").checked,
		s_change: document.querySelector("#s_change").checked,
	});
	
	var xhr = new XMLHttpRequest();
	xhr.open("GET", document.querySelector("#wdurl").value, true,
		document.querySelector("#user").value,
		document.querySelector("#password").value);
	xhr.withCredentials = true;
	let message = document.getElementById('wmessage');
	xhr.onload = function () {
		switch(xhr.status) {

			
			
			case 404: 	message.textContent = 'Login failed: Please check the WebDAV URL. It should be in a form like https://servername/folder';
						message.style.cssText = "background: #ff7d52; padding: 3px; margin: 2px;";
						break;
			case 401:	message.textContent = 'Login failed: Please check username and password';
						message.style.cssText = "background: #ff7d52; padding: 3px; margin: 2px;";
						break;
			case 200:	message.textContent = 'Login successfully. Options saved';
						message.style.cssText = "background: #98FB98; padding: 3px; margin: 2px;";
						browser.storage.local.set({
							wdurl: document.querySelector("#wdurl").value,
							user: document.querySelector("#user").value,
							password: document.querySelector("#password").value,
						});
						break;
			default:	message.textContent = 'Login failed: Status = ' + xhr.status;
						message.style.cssText = "background: #ff7d52; padding: 3px; margin: 2px;";
						break;
		}
	};
	xhr.send();
	
}

function restoreOptions() {
	function setCurrentChoice(result) {
		document.querySelector("#wdurl").value = result.wdurl || "";
		document.querySelector("#user").value = result.user || "";
		document.querySelector("#password").value = result.password || "";
		
		document.querySelector("#s_startup").checked = result.s_startup || false;
		document.querySelector("#s_create").checked = result.s_create || false;
		document.querySelector("#s_remove").checked = result.s_remove || false;
		document.querySelector("#s_change").checked = result.s_change || false;

		checkForm();
		
		last_sync = result.last_s || 0;
		if(last_sync.toString().length > 0) {
			document.querySelector("#s_startup").removeAttribute("disabled");
		}
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var getting = browser.storage.local.get();
	getting.then(setCurrentChoice, onError);
}

function manualImport() {
	var bookmarks = browser.bookmarks.search({});
	bookmarks.then(doImport, background_page.onRejected);
	
	function doImport(bookmarks) {
		let count = 0;
		for (item of bookmarks) {
			if(typeof item.url !== 'undefined' && item.url.startsWith("http"))
				count++;
		}
		
		if(count > 0) {
			let modal = document.getElementById('importConfirm');
			let impMessage = document.getElementById('impMessage');
			var span = document.getElementsByClassName("close")[0];
			
			modal.style.display = "block";
			span.onclick = function() {
				modal.style.display = "none";
			}
			
			impMessage.textContent = 'You have ' + count + ' bookmarks saved in your library. Would you like to remove them before you import new bookmarks?';
			
			document.getElementById('impYes').onclick = function(e) {
				background_page.removeAllMarks();
				browser.storage.local.set({last_s: 1});
				background_page.getDAVMarks();
				modal.style.display = "none";
			};
			
			document.getElementById('impNo').onclick = function(e) {
				background_page.getDAVMarks();
				modal.style.display = "none";
			};
			
			document.getElementById('impCancel').onclick = function(e) {
				modal.style.display = "none";
			};
		}
		else {
			browser.storage.local.set({last_s: 1});
			document.querySelector("#s_startup").removeAttribute("disabled");
			background_page.getDAVMarks();
		}
	}
}

function manualRemove() {
	if(confirm("When you continue, all your current bookmarks are removed. Are you sure?")) {
		background_page.removeAllMarks();
	}
}

function manualExport() {
	var gettingTree = browser.bookmarks.getTree();
	background_page.saveMarks();
}

function syncWarning() {
	if(document.getElementById("s_startup").checked) {
		if(confirm("Warning: If you use \"Firefox Sync\" and activate the option \"Browser startup\", it is possible that bookmarks you get duplicates, even if the bookmarks are validated during import. Should this option still be activated?")) {
			document.getElementById("s_startup").checked = true;
		}
		else {
			document.getElementById("s_startup").checked = false;
		}
	}
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.getElementById("mdownload").addEventListener("click", manualImport);
document.getElementById("mupload").addEventListener("click", manualExport);
document.getElementById("mremove").addEventListener("click", manualRemove);
document.getElementById("wdurl").addEventListener("keyup", checkForm);
document.getElementById("user").addEventListener("keyup", checkForm);
document.getElementById("password").addEventListener("keyup", checkForm);
document.getElementById("s_startup").addEventListener("input", syncWarning);
