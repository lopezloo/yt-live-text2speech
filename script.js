var options = {
	voiceType: '',
	voice: null,
	emojisEnabled: true,
	voiceRate: 1.0,
	voicePitch: 1.0,
}

function loadOptions() {
	chrome.storage.sync.get({
		// default values
		voiceType: '',
		emojisEnabled: true,
		voiceRate: 1.0,
		voicePitch: 1.0
	}, function(items) {
		options.voiceType = items.voiceType;
		options.emojisEnabled = items.emojisEnabled;
		options.voiceRate = items.voiceRate;
		options.voicePitch = items.voicePitch;
		console.log('loadOptions: voice: ' + items.voiceType + ' emojis: ' + items.emojisEnabled + ' rate: ' + items.voiceRate + ' pitch: ' + items.voicePitch);
	});
}
loadOptions();

var voices = [];
window.speechSynthesis.onvoiceschanged = function() {
	voices = speechSynthesis.getVoices();
	console.log('Loaded ' + voices.length + ' voices.');
	updateVoice();
};

function updateVoice() {
	for(i = 0; i < voices.length; i++) {
		if(voices[i].lang == options.voiceType) {
			options.voice = voices[i];
			console.log('Using voice: ' + voices[i].name + ' (' + voices[i].lang + ')' + ' (localService: ' + voices[i].localService + ')')
			break;
		}
	}
}

chrome.storage.onChanged.addListener(function(changes, areaName) {
	if(changes.voiceType) {
		options.voiceType = changes.voiceType.newValue;
	}
	if(changes.emojisEnabled) {
		options.emojisEnabled = changes.emojisEnabled.newValue;
	}
	if(changes.voiceRate) {
		options.voiceRate = changes.voiceRate.newValue;
	}
	if(changes.voicePitch) {
		options.voicePitch = changes.voicePitch.newValue;
	}
	console.log('Options changed. Voice: ' + options.voiceType + ' Emojis: ' + options.emojisEnabled + ' rate: ' + options.voiceRate + ' pitch: ' + options.voicePitch);
	updateVoice();
})

class ChatWatcher {
	constructor() {
		this.queue = {};
		this.currentMsg = null;
		this.paused = false;
	}

	onSpeechEnd() {
		delete this.queue[this.currentMsg];
		this.currentMsg = null;
		this.updateSpeech();
	}

	switchPause() {
		this.paused = !this.paused;
		this.updateSpeech();
	}

	updateSpeech() {
		if(!this.paused && this.currentMsg === null) {
			if(voices.length == 0) {
				console.log('ERROR: No voices loaded.')
				return;
			}

			if(Object.keys(this.queue).length > 0) {
				let id = Object.keys(this.queue)[0];
				this.currentMsg = id;
				let msg = this.queue[id];
				let msgt = msg[0] + ': ' + msg[1];
				console.log(msgt + ' (' + Object.keys(this.queue).length + ' in queue)');

				let u = new SpeechSynthesisUtterance(msgt);

				// Don't trust it. It's buggy.
				//u.onend = this.onSpeechEnd;

				u.voice = options.voice;
				u.rate = options.voiceRate;
				u.pitch = options.voicePitch;
				speechSynthesis.speak(u);

				// Thanks to: https://gist.github.com/mapio/967b6a65b50d39c2ae4f
				let _this = this;
				function _wait() {
					if(!speechSynthesis.speaking) {
						_this.onSpeechEnd();
						return;
					}
					window.setTimeout(_wait, 200);
				}
				_wait();
			}
		}
	}

	addToQueue(id, author, msg) {
		//console.log('addToQueue ' + id);
		this.queue[id] = [author, msg];
		this.updateSpeech();
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

function initWatching() {
	var watcher = new ChatWatcher();

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

						let msg;
						if(options.emojisEnabled) {
							msg = getTextWithAlts($(this).find('#message'));
						} else {
							msg = $(this).find('#message').text();
						}
						watcher.addToQueue(id, author, msg);
					}
				});
			}
		});
	}

	var keypressed = false;
	function onKeydown(e) {
		if(!keypressed && e.which == 32) { // spacebar
			keypressed = true;
			$activeElement = $(parent.document.activeElement);
			if($('yt-live-chat-text-input-field-renderer').attr('focused') !== '' &&
				!$activeElement.is('input') &&
				!$activeElement.is('textarea')
			) {
				watcher.switchPause();
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
}

$(document).ready(function() {
	console.log('yt-live-text2speech ready!');

	// Init chat after 1s (simple way to prevent reading old messages)
	window.setTimeout(initWatching, 1000);
});
