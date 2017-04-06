/*
TODO:
removed msgs should also remove from queue
don't speech if message is empty or contains only non-speechable stuff (emojis etc.)
*/

class ChatWatcher {
	constructor() {
		this.queue = [];
		this.isTalking = false;
	}

	onSpeechEnd() {
		watcher.queue.shift();
		watcher.isTalking = false;
		watcher.update();
	}

	update() {
		if(!this.isTalking && this.queue.length > 0) {
			this.isTalking = true;
			let msg = this.queue[0];
			console.log(msg[0] + ': ' + msg[1] + ' (' + this.queue.length + ' in queue)');

			let u = new SpeechSynthesisUtterance(msg);
			u.onend = this.onSpeechEnd;
			speechSynthesis.speak(u);
		}
	}

	addToQueue(author, msg) {
		this.queue.push([author, msg]);
		this.update();
	}
}
var watcher = new ChatWatcher();

$(document).ready(function() {
	console.log('yt-live-text2speech ready!');

	let targetNodes = $(".yt-live-chat-item-list-renderer", frames['#live-chat-iframe']);
	let MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	let myObserver = new MutationObserver(mutationHandler);
	let obsConfig = {
		childList: true,
		characterData: true,
		attributes: true,
		subtree: true
	};

	targetNodes.each(function() {
		myObserver.observe(this, obsConfig);
	});

	function mutationHandler(mutationRecords) {
		mutationRecords.forEach(function(mutation){
			if(mutation.addedNodes !== null) {
				$(mutation.addedNodes).each(function() {
					if ($(this).is('yt-live-chat-text-message-renderer')) {
						let author = $(this).find('#author-name').text();
						let msg = $(this).find('#message').text();
						//console.log(author + ' ' + msg);
						watcher.addToQueue(author, msg);
					}
				});
			}
		});
	}
});
