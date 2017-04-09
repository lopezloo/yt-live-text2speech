document.addEventListener('DOMContentLoaded', function() {
	var voiceSelect = document.getElementById('voice');
	var emojisCheck = document.getElementById('emojis');
	var statusText = document.getElementById('status');

	function saveChanges() {
		var voice = voiceSelect.options[voiceSelect.selectedIndex].value;
		var emojis = emojisCheck.checked;

		chrome.storage.sync.set({
			voiceType: voice,
			emojisEnabled: emojis
		}, function() {
			statusText.textContent = 'Options saved.';
			console.log('saveChanges: voice: ' + voice + ' emojis: ' + emojis);
		});
	}

	function loadOptions() {
		chrome.storage.sync.get({
			// default values
			voiceType: '',
			emojisEnabled: true
		}, function(items) {
			console.log('loadOptions: voice: ' + items.voiceType + ' emojis: ' + items.emojisEnabled);
			voiceSelect.value = items.voiceType;
			emojisCheck.checked = items.emojisEnabled;
		});
	}
	loadOptions();

	voiceSelect.addEventListener('change', saveChanges);
	emojisCheck.addEventListener('change', saveChanges);

	window.speechSynthesis.onvoiceschanged = function() {
		var voices = speechSynthesis.getVoices();
		for(i = 0; i < voices.length; i++) {
			var option = document.createElement('option');
			option.textContent = voices[i].name + ' (' + voices[i].lang + ')';
			option.value = voices[i].lang;
			option.setAttribute('data-name', voices[i].name);
			voiceSelect.appendChild(option);
		}
		console.log('Options: loaded ' + voices.length + ' voices.');
	};
});
