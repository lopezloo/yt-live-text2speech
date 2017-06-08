var options = {
	voiceType: '',
	voice: null,
	emojisEnabled: true,
	voiceRate: 1.0,
	voicePitch: 1.0,
	voiceVolume: 1.0,
	delay: 0.0
}

function loadOptions() {
	chrome.storage.sync.get({
		// default values
		voiceType: '',
		emojisEnabled: true,
		voiceRate: 1.0,
		voicePitch: 1.0,
		voiceVolume: 1.0,
		delay: 0.0
	}, function(items) {
		options.voiceType = items.voiceType;
		options.emojisEnabled = items.emojisEnabled;
		options.voiceRate = items.voiceRate;
		options.voicePitch = items.voicePitch;
		options.voiceVolume = items.voiceVolume;
		options.delay = items.delay;
		console.log('loadOptions: voice: ' + items.voiceType + ' emojis: ' + items.emojisEnabled + ' rate: ' + items.voiceRate + ' pitch: ' + items.voicePitch + ' volume: ' + items.voiceVolume + ' delay: ' + items.delay);
	});
}
loadOptions();

var voices = [];
function updateVoice() {
	for(i = 0; i < voices.length; i++) {
		// .lang check is for legacy support
		if(voices[i].voiceURI == options.voiceType || voices[i].lang == options.voiceType) {
			options.voice = voices[i];
			console.log('Using voice: ' + voices[i].name + ' (' + voices[i].lang + ')' + ' (local: ' + voices[i].localService + ')')
			return;
		}
	}
	options.voice = voices[0];
}

chrome.storage.onChanged.addListener(function(changes, areaName) {
	for(let k in changes) {
		if(k in options) {
			options[k] = changes[k].newValue;
		}
	}
	console.log('Options changed. Voice: ' + options.voiceType + ' Emojis: ' + options.emojisEnabled + ' rate: ' + options.voiceRate + ' pitch: ' + options.voicePitch + ' volume: ' + options.voiceVolume + ' delay: ' + options.delay);
	updateVoice();
})

class ChatWatcher {
	constructor() {
		this.queue = {};
		this.currentMsg = null;
		this.paused = false;

		// Chat can be detached to popup (however YT still updates messages)
		this.detached = false;
	}

	onSpeechEnd() {
		delete this.queue[this.currentMsg];
		this.currentMsg = null;
		this.delaying = true;
		let _this = this;
		setTimeout(function() {
			_this.delaying = false;
			_this.updateSpeech();
		}, options.delay*1000);
	}

	switchPause() {
		this.paused = !this.paused;
		this.updateSpeech();
	}

	updateSpeech() {
		if(!this.paused && this.currentMsg === null && !this.detached && !this.delaying) {
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
				u.volume = options.voiceVolume;
				speechSynthesis.speak(u);

				let startTime = +new Date();
				// Thanks to: https://gist.github.com/mapio/967b6a65b50d39c2ae4f
				let _this = this;
				function _wait() {
					if(!speechSynthesis.speaking) {
						_this.onSpeechEnd();
						return;
					}

					// Long messages can sometimes stop playing and .speaking still returns true
					// Long means vocally long (for example 200*emoji)
					// Thanks to this protection at least the whole reader doesn't break up.
					if((+new Date()) - startTime > 30*1000) {
						console.log('WARNING: Current message was playing longer than 30 seconds and was stopped.');
						speechSynthesis.cancel();
						_this.onSpeechEnd();
						return;
					}
					setTimeout(_wait, 200);
				}
				_wait();
			}
		}
	}

	addToQueue(id, author, msg) {
		//console.log('addToQueue ' + id);
		if(!(id in this.queue) && !this.detached) {
			this.queue[id] = [author, msg];
			this.updateSpeech();
		}
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

	onDetachedStateChanged(detached) {
		if(detached != this.detached) {
			this.detached = detached;
			console.log('Chat detached: ' + this.detached);
			if(this.detached) {
				// Chat got detached to external window. We assume user want
				// listen messages in that window, so clear current messages now.
				// If he ever goes back, only new messages should play in that case.
				for(let id in this.queue) {
					this.removeMsg(id);
				}
			}
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

var watcher = null;
function initWatching() {
	console.log('yt-live-text2speech: initializing...')
	watcher = new ChatWatcher();

	// without .iron-selected = detached chat
	let targetNodes = $('#chat-messages.style-scope.yt-live-chat-renderer.iron-selected');
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
		mutationRecords.forEach(function(mutation) {
			//console.log(mutation);

			if(mutation.attributeName === 'is-deleted') {
				// Message was deleted
				watcher.removeMsg(mutation.target.id);
			} 
			else if(mutation.attributeName === 'id') {
				if(mutation.oldValue !== null) {
					// YT gives temporary ID for own messages, which needs to be updated
					watcher.updateMsgID(mutation.oldValue, mutation.target.id);
				}
			}
			else if(mutation.attributeName === 'class' && $(mutation.target).is('#chat-messages')) {
				// Chat got detached/attached
				let detached = $('yt-live-chat-ninja-message-renderer').is('.iron-selected');
				watcher.onDetachedStateChanged(detached);
			}
			else if (mutation.addedNodes !== null) {
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

// Inject into YT interface to create our options inside the chat
function initInterface() {
	// Injects our menu option
	function updateMenu(menu) {
		$(menu).find('ytd-menu-popup-renderer').css('max-height', '260px');
		let $option = $('\
<ytd-menu-service-item-renderer is="ytd-menu-service-item-renderer" role="option" tabindex="-1" aria-disabled="false" class="speech-option style-scope ytd-menu-popup-renderer x-scope ytd-menu-service-item-renderer-0">\
	<template is="dom-if" class="style-scope ytd-menu-service-item-renderer"></template>\
</ytd-menu-service-item-renderer>\
		');
		$(menu).find('paper-menu > div').append($option);

		let $optionName = $('<yt-formatted-string class="style-scope ytd-menu-service-item-renderer x-scope yt-formatted-string-0"></yt-formatted-string>');
		$option.append($optionName);
		$optionName[0].innerHTML = 'Speech options';

		$option.click(function() {
			// Hide all content pages
			$('iron-pages#content-pages').children().each(function() {
				$(this).removeClass('iron-selected');
			});

			// Set our page visibility
			let $page = $('iron-pages#content-pages > yt-live-chat-speech-options-renderer');
			if($page.hasClass('iron-selected')) {
				$page.removeClass('iron-selected');
			} else {
				$page.addClass('iron-selected');
			}

			// Hide menu
			$('iron-dropdown').css('display', 'none');
			$('iron-dropdown').attr('aria-hidden', 'true');
		})
	}

	function addOptionMenu(menu) {
		setTimeout(updateMenu, 1, menu);

		// Create another observer to check if YT removes our option
		// and create it again in that case
		let observer = new MutationObserver(function(mutationRecords) {
			mutationRecords.forEach(function(mutation) {
				$(mutation.removedNodes).each(function() {
					if($(this).hasClass('speech-option')) {
						updateMenu(menu);
						return false;
					}
				});
			});
		});
		observer.observe($(menu).find('paper-menu > div')[0], {
			childList: true,
			attributes: false,
			characterData: false,
			subtree: false
		});
	}

	if($('yt-live-chat-app > iron-dropdown').length > 0) {
		addOptionMenu($('yt-live-chat-app > iron-dropdown'));
	} else {
		// Observe to detect when chat menu loads to inject our custom option
		let chatMenuMutationObserver = new MutationObserver(chatMenuMutationHandler);
		function chatMenuMutationHandler(mutationRecords) {
			mutationRecords.forEach(function(mutation) {
				$(mutation.addedNodes).each(function() {
					if($(this).is('iron-dropdown')) {
						// We got what we need, stop observing
						chatMenuMutationObserver.disconnect();
						addOptionMenu(this);
					};
				});
			});
		}
		chatMenuMutationObserver.observe($('yt-live-chat-app')[0], {
			childList: true,
			attributes: false,
			characterData: false,
			subtree: false
		});
	}

	// Inject our options page
	function updatePages() {
		let $optionPage = $('\
<yt-live-chat-speech-options-renderer class="style-scope yt-live-chat-renderer x-scope yt-live-chat-participant-list-renderer-0">\
	<div id="header" role="heading" class="style-scope yt-live-chat-participant-list-renderer">\
		Speech options\
	</div>\
	<div id="participants" class="style-scope yt-live-chat-participant-list-renderer" style="overflow-y: initial;">\
		<iframe src="' + chrome.extension.getURL('options.html') + '" style="width: 100%; height: 100%;">\
	</div>\
</yt-live-chat-speech-options-renderer>\
		');
		
	  	let $icon = $('\
<paper-icon-button id="back-button" icon="yt-icons:back" class="style-scope yt-live-chat-speech-options-renderer x-scope paper-icon-button-0" role="button" tabindex="0" aria-disabled="false">\
	<iron-icon id="icon" class="style-scope paper-icon-button x-scope iron-icon-0">\
		<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" class="style-scope iron-icon" style="pointer-events: none; display: block; width: 100%; height: 100%;">\
			<g class="style-scope iron-icon">\
				<path class="style-scope iron-icon"></path>\
			</g>\
		</svg>\
	</iron-icon>\
</paper-icon-button>\
		');

	  	// Append page and icon
		$('iron-pages#content-pages').append($optionPage);
		$optionPage.find('#header').prepend($icon);

		// Handle back icon
		$icon.click(function() {
			$('yt-live-chat-speech-options-renderer').removeClass('iron-selected');
			$('#chat-messages').addClass('iron-selected');
		});
	}
	updatePages();

	// Observe to detect when YT removes our injected page
	observer = new MutationObserver(function(mutationRecords) {
		mutationRecords.forEach(function(mutation) {
			$(mutation.removedNodes).each(function() {
				if($(this).is('yt-live-chat-speech-options-renderer')) {
					// Our page was removed, inject it again
					updatePages();
					return false;
				}
			});
		});
	});
	observer.observe($('iron-pages#content-pages')[0], {
		childList: true,
		attributes: false,
		characterData: false,
		subtree: false
	});
}

$(document).ready(function() {
	console.log('yt-live-text2speech ready!');

	initInterface();
	speechSynthesis.onvoiceschanged = function() {
		// For some reason, this event can fire multiple times.
		if(voices.length == 0) {
			voices = speechSynthesis.getVoices();
			console.log('Loaded ' + voices.length + ' voices.');
			updateVoice();

			if(watcher === null) {
				// Init chat after 2s (simple way to prevent reading old messages)
				setTimeout(initWatching, 2000);
			}
		}
	};
});

window.onbeforeunload = function() {
	// Browser won't stop speaking after closing tab.
	// So shut up, pls.
	speechSynthesis.cancel();
};
