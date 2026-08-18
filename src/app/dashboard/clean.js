const fs = require('fs');
const file = 'c:/Users/guill/OneDrive/Documentos/GitHub/obrasaas/src/app/dashboard/page.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\s*\/\/ Auto-scroll chat to bottom[\s\S]*?\}, \[chatMessages, activeTab\]\);/, '');
content = content.replace(/\s*\/\/ Draw Static Waveforms on canvases[\s\S]*?\}, \[activeTab\]\);/, '');
content = content.replace(/\s*\/\/ Audio Playback waveform animation[\s\S]*?\}, \[playingAudioIndex\]\);/, '');
content = content.replace(/\s*\/\/ Play simulated audio notes[\s\S]*?const playAudioSim = \(index\) => \{[\s\S]*?\n  \};/, '');
content = content.replace(/\s*\/\/ Replay audio directly from chat bubble[\s\S]*?const replayAudio = \(\) => \{[\s\S]*?\n  \};/, '');
content = content.replace(/\s*const handleSendMessage = async \(\) => \{[\s\S]*?\n  \};/, '');
content = content.replace(/\s*\/\/ Select simulated attachments[\s\S]*?const selectAttachment = async \(type\) => \{[\s\S]*?\n  \};/, '');
content = content.replace(/\s*const confirmGpsSend = async \(\) => \{[\s\S]*?\n  \};/, '');
content = content.replace(/\s*const refreshGpsSearch = \(\) => \{[\s\S]*?\n  \};/, '');

fs.writeFileSync(file, content);
console.log('Cleaned page.js');
