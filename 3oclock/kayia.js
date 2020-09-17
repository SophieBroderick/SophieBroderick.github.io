function Kayia(config) {
    this.config = { expiration : 0 /* when session expires in milleseconds; 0 = never */ };
    if (config) this.config = config;
    var WS = window.WebSocket || window.MozWebSocket;
    if (WS) this.socket = new WS('wss://kayia.com');
}
Kayia.prototype.bindload = function() {
	if (this.bindings) for (var id in this.bindings) {
		this.bindcall(id, this.bindings[id].query);
	}
}
Kayia.prototype.bindcall = function (id, msg) { this._transmit(this._sessionID() + '\t' + id + '\t' + msg); } 
Kayia.prototype.rebind = function (id, query) { if (this.bindings) { this.bindings[id].query = query; this.bindcall(id, 
query); } } Kayia.prototype.execute = function (msg) { this._transmit(this._sessionID() + '\t' + msg); } 
Kayia.prototype.query = function (msg, callback, errcall, expires) { // Expires is an integer of minutes
        if (!expires) expires = 15; // Default length of live update session is 15 minutes
	if (!this.queries) this.queries = {};
	var k = this;
	this.queries[msg] = { 'message' : msg, 'callback' : callback, 'errcall' : errcall, 'expires' : (new Date().getTime() 
+ expires), 'query' : function(newmsg) {
		k.queries[newmsg] = {};
		k.queries[newmsg].callback = k.queries[this.message].callback;
		k.queries[newmsg].errcall = k.queries[this.message].errcall;
		k.queries[newmsg].message = newmsg;
		k._transmit(k._sessionID() + '~' + this.expires + '\t' + newmsg);
	  }
	};
	this._transmit(this._sessionID() + '~' + (new Date().getTime() + (expires * 60000)) + '\t' + msg);
	return this.queries[msg];
}
Kayia.prototype.login = function (username, password, callback, errcall) {
	this._transmit(':\t' + username + '\t' + password);
	if (callback) this.login_callback = callback;
	if (errcall) this.login_error = errcall;
}
Kayia.prototype.logout = function (callback) { if (this.isAuthenticated()) { this._setCookie('Kayia-SessionID',''); 
this._transmit(':' + this._sessionID()); } if (callback) callback(); } Kayia.prototype.register = function (userObject, 
callback, errcall) { this.insert('Users', userObject); this.login(userObject.username, userObject.password); } 
Kayia.prototype.isAuthenticated = function () { return (this._sessionID()[0] != 'c'); } Kayia.prototype.insert = function 
(list, obj) { this._transmit(this._sessionID() + '\t' + list + '+=' + JSON.stringify(obj)); } Kayia.prototype.remove = 
function (list, obj) { this._transmit(this._sessionID() + '\t' + list + '-=' + JSON.stringify(obj)); } 
Kayia.prototype.onmessage = function (data) {
	if (data.length > 0 && data.substr(0,1) == '\t') {
		if (data.length > 6 && data.substr(1,6) == '#ERROR') { if (this.login_error) this.login_error(data); }
		else {
			this._setCookie('Kayia-SessionID', data.substr(1));
			if (this.login_callback) this.login_callback();
		}
	}
	else { //[Query]\t[Result]
		var queryID = data.split('\t')[0];
		var result = (data.indexOf('\t') >= 0) ? data.split('\t')[1] : '';
		if (this.bindings && this.bindings[queryID]) {
			if (result.length > 6 && result.substr(0,6) == '#ERROR') { if (this.bindings[queryID].errcall) 
this.bindings[queryID].errcall(result); }
			else {
				if (queryID && this.bindings[queryID].callback && result != 'undefined') {
					if (this.bindings[queryID].elem) {
						this.bindings[queryID].callback(JSON.parse(result), 
this.bindings[queryID].elem, this.bindings[queryID].innerHTML);
					} else { this.bindings[queryID].callback(JSON.parse(result)); }
				}
				else if (queryID && this.bindings[queryID].elem) this.bindings[queryID].elem.innerHTML = 
result;
			}
		} else {
			if (this.queries && this.queries[queryID]) {
				if (result.length > 6 && result.substr(0,6) == '#ERROR') { if 
(this.queries[queryID].errcall) this.queries[queryID].errcall(result); }
				else { if (this.queries[queryID].callback) 
this.queries[queryID].callback(JSON.parse(result)); }
			}
		}
	}
}
Kayia.prototype.renderRepeat = function(data, element, innerHTML) {
	var result = '';
	for (var item in data) {
		for (var i = 0; i < element.childNodes.length; i++) {
			var template = element.childNodes[i];
			if (template.getAttribute && template.getAttribute('data')) {
				template.innerHTML = data[item][template.getAttribute('data')];
			}
			if (template.outerHTML) result += template.outerHTML;
		}
	}
	element.innerHTML = result;
}
Kayia.prototype.bind = function() {
	document.addEventListener("DOMContentLoaded", function () { setTimeout(
	function() {
		var elements = document.getElementsByTagName("*");
		for (var i in elements) {
			var element = elements[i];
			if (element.getAttribute && element.getAttribute('data')) {
				var binding = element.getAttribute('data');
				if (!this.bindings) this.bindings = {}
				if (element.tagName == 'REPEAT') {
					this.bindings[binding] = { query: binding, elem : element, callback : 
this.renderRepeat, innerHTML : element.innerHTML };
				}
				else {
					this.bindings[binding] = { query: binding, elem : element };
				}
			}
		}
		this.bindload();
	}, 80); });
}
Kayia.prototype._getCookie = function(name) { if (localStorage[name]) return localStorage[name]; var nameEQ = name + "="; 
var ca = document.cookie.split(';'); for(var i=0;i < ca.length;i++) { var c = ca[i]; while (c.charAt(0) === ' ') { c = 
c.substring(1,c.length); } if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length,c.length); } } return null;
}
Kayia.prototype._setCookie = function(name, value, days) { var expires; if (days) { var date = new Date(); 
date.setTime(date.getTime() + this.config.login-expires); expires = "; expires="+date.toGMTString(); } else { expires = ""; 
} document.cookie = name+"="+value+expires+"; path=/"; if (document.cookie.length == 0) localStorage[name] = value; }
Kayia.prototype._sessionID = function() { if (this._getCookie('Kayia-SessionID') === null || 
this._getCookie('Kayia-SessionID') == '') { var d = new Date().getTime(); var sessionID = 'c' + 'xxxxxxxx'.replace(/[xy]/g, 
function(c) { var r = (d + Math.random()*16)%16 | 0; d = Math.floor(d/16); return (c=='x' ? r : (r&0x3|0x8)).toString(16); 
}); this._setCookie('Kayia-SessionID', sessionID); } return this._getCookie('Kayia-SessionID'); }
Kayia.prototype._transmit = function(msg) {
	if (!this.socket || this.socket == {}) {
            var WS = window.WebSocket || window.MozWebSocket;
            if (WS) this.socket = new WS('wss://lawandme.com');
	}
	var k = this;
	if (!this.socket.onmessage) { this.socket.onmessage = function(event) { k.onmessage(event.data); }; }
        this.socket.onopen = function() { this.send(msg); };
	if (this.socket.readyState == 1) { this.socket.send(msg); }
}
