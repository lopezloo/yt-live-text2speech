document.addEventListener('DOMContentLoaded', function() {
	var voiceSelect = document.getElementById('voice');
	var emojisCheck = document.getElementById('emojis');
	var rateInput = document.getElementById('rate');
	var pitchInput = document.getElementById('pitch');
	var statusText = document.getElementById('status');

	function saveChanges() {
		var voice = voiceSelect.options[voiceSelect.selectedIndex].value;
		var emojis = emojisCheck.checked;
		var voiceRate = rateInput.value;
		var voicePitch = pitchInput.value;

		chrome.storage.sync.set({
			voiceType: voice,
			emojisEnabled: emojis,
			voiceRate: voiceRate,
			voicePitch: voicePitch
		}, function() {
			statusText.textContent = 'Options saved.';
			console.log('saveChanges: voice: ' + voice + ' emojis: ' + emojis + ' rate: ' + voiceRate + ' pitch: ' + voicePitch);
		});
	}

	function loadOptions() {
		chrome.storage.sync.get({
			// default values
			voiceType: '',
			emojisEnabled: true,
			voiceRate: 1.0,
			voicePitch: 1.0
		}, function(items) {
			console.log('loadOptions: voice: ' + items.voiceType + ' emojis: ' + items.emojisEnabled + ' rate: ' + items.voiceRate + ' pitch: ' + items.voicePitch);
			voiceSelect.value = items.voiceType;
			emojisCheck.checked = items.emojisEnabled;
			rateInput.value = items.voiceRate;
			pitchInput.value = items.voicePitch;
		});
	}
	loadOptions();

	voiceSelect.addEventListener('change', saveChanges);
	emojisCheck.addEventListener('change', saveChanges);
	rateInput.addEventListener('change', saveChanges);
	pitchInput.addEventListener('change', saveChanges);

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
