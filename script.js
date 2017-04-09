/*
TODO:
options: language, auto mode, emojis
*/

class ChatWatcher {
	constructor() {
		this.queue = {};
		this.currentMsg = null;
	}

	onSpeechEnd() {
		delete watcher.queue[watcher.currentMsg];
		watcher.currentMsg = null;
		// if this.auto
		//watcher.updateSpeech();
	}

	updateSpeech() {
		if(this.currentMsg !== null) {
			// Skip current
			this.removeMsg(this.currentMsg);
		}

		if(Object.keys(this.queue).length > 0) {
			let id = Object.keys(this.queue)[0];
			this.currentMsg = id;
			let msg = this.queue[id];
			let msgt = msg[0] + ': ' + msg[1];
			console.log(msgt + ' (' + Object.keys(this.queue).length + ' in queue)');

			speechSynthesis.cancel();
			let u = new SpeechSynthesisUtterance(msgt);
			u.onend = this.onSpeechEnd;
			speechSynthesis.speak(u);
		}
	}

	addToQueue(id, author, msg) {
		//console.log('addToQueue ' + id);
		this.queue[id] = [author, msg];
		// if this.auto
		//this.updateSpeech();
	}

	updateMsgID(id, newId) {
		// Sometimes message with given ID can be already removed.
		if(id in this.queue) {
			//console.log('updateMsgID: ' + id + ' => ' + newId);
			this.queue[newId] = this.queue[id];
			if(this.currentMsg == id) {
				this.currentMsg = newId;
			}
			delete this.queue[id];
		}
	}

	removeMsg(id) {
		if(id in this.queue) {
			//console.log('removeMsg: ' + id);
			if(id == this.currentMsg) {
				// Stop current message
				speechSynthesis.cancel();
				this.currentMsg = null;
			}
			delete this.queue[id];
		}
	}
}
var watcher = new ChatWatcher();

$(document).ready(function() {
	console.log('yt-live-text2speech ready!');

	let targetNodes = $('.yt-live-chat-item-list-renderer');
	let MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	let myObserver = new MutationObserver(mutationHandler);
	let obsConfig = {
		childList: true,
		characterData: true,
		attributes: true,
		subtree: true,
		attributeOldValue: true
	};

	targetNodes.each(function() {
		myObserver.observe(this, obsConfig);
	});

	function mutationHandler(mutationRecords) {
		mutationRecords.forEach(function(mutation){
			if(mutation.attributeName == 'id') {
				if(mutation.oldValue !== null) {
					// YT gives temporary ID for own messages, which needs to be updated
					watcher.updateMsgID(mutation.oldValue, mutation.target.id);
				}
			}
			else if(mutation.attributeName == 'is-deleted') {
				// Message was removed
				watcher.removeMsg(mutation.target.id);
			} else if (mutation.addedNodes !== null) {
				$(mutation.addedNodes).each(function() {
					if ($(this).is('yt-live-chat-text-message-renderer')) {
						let id = $(this)[0].id;
						let author = $(this).find('#author-name').text();
						let msg = getTextWithAlts($(this).find('#message'));
						watcher.addToQueue(id, author, msg);
					}
				});
			}
		});
	}

	function getTextWithAlts(e) {
		let txt = '';
		e.contents().each(function() {
			if($(this).get(0).nodeType == 1 && $(this).is('img')) {
				// img (emoji)
				txt += $(this).attr('alt');
			} else {
				// text or span (mentions)
				txt += $(this).text();
			}
		});
		return txt;
	}

	var keypressed = false;
	function onKeydown(e) {
		if(!keypressed && e.which == 32) { // spacebar
			keypressed = true;
			let focused = $('yt-live-chat-text-input-field-renderer').attr('focused') == '';
			if(!focused) {
				watcher.updateSpeech();
				e.preventDefault();
			}
		}
	}
	function onKeyup(e) {
		if(keypressed && e.which == 32) {
			keypressed = false;
		}
	}
	$(document).keydown(onKeydown);
	$(parent.document).keydown(onKeydown);
	$(document).keyup(onKeyup);
	$(parent.document).keyup(onKeyup);
});
