document.addEventListener('DOMContentLoaded', function() {
	let voiceSelect = document.getElementById('voice');
	let emojisCheck = document.getElementById('emojis');
	let rateInput = document.getElementById('rate');
	let pitchInput = document.getElementById('pitch');
	let volumeInput = document.getElementById('volume');
	let statusText = document.getElementById('status');

	function saveChanges() {
		let voice = voiceSelect.options[voiceSelect.selectedIndex].value;
		let emojis = emojisCheck.checked;
		let voiceRate = rateInput.value;
		let voicePitch = pitchInput.value;
		let voiceVolume = volumeInput.value;

		chrome.storage.sync.set({
			voiceType: voice,
			emojisEnabled: emojis,
			voiceRate: voiceRate,
			voicePitch: voicePitch,
			voiceVolume: voiceVolume,
		}, function() {
			statusText.textContent = 'Options saved.';
			console.log('Changes saved! Voice: ' + voice + '; emojis: ' + emojis + '; rate: ' + voiceRate + '; pitch: ' + voicePitch + '; volume: ' + voiceVolume);
		});
	}

	function loadOptions() {
		chrome.storage.sync.get({
			// default values
			voiceType: '',
			emojisEnabled: true,
			voiceRate: 1.0,
			voicePitch: 1.0,
			voiceVolume: 1.0,
		}, function(items) {
			console.log('Options loaded! Voice: ' + items.voiceType + '; emojis: ' + items.emojisEnabled + '; rate: ' + items.voiceRate + '; pitch: ' + items.voicePitch + '; volume: ' + items.voiceVolume);
			voiceSelect.value = items.voiceType;
			emojisCheck.checked = items.emojisEnabled;
			rateInput.value = items.voiceRate;
			pitchInput.value = items.voicePitch;
			volumeInput.value = items.voiceVolume;
		});
	}

	voiceSelect.addEventListener('change', saveChanges);
	emojisCheck.addEventListener('change', saveChanges);
	rateInput.addEventListener('change', saveChanges);
	pitchInput.addEventListener('change', saveChanges);
	volumeInput.addEventListener('change', saveChanges);

	window.speechSynthesis.onvoiceschanged = function() {
		let voices = speechSynthesis.getVoices();
		for(i = 0; i < voices.length; i++) {
			let option = document.createElement('option');
			option.textContent = voices[i].name;
			if(voices[i].lang !== '') {
				option.textContent += ' (' + voices[i].lang + ')';	
			}
			if(voices[i].localService) {
				option.textContent += ' (local)';
			} else {
				option.textContent += ' (network)';
			}
			option.value = voices[i].lang;
			option.setAttribute('data-name', voices[i].name);
			voiceSelect.appendChild(option);
		}
		console.log('Options: loaded ' + voices.length + ' voices.');
		loadOptions();
	};
});
