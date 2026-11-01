// Generates demo/audio/pN.mp3 (+ durN.txt) from narration.json with ElevenLabs; falls back to macOS say.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const D = new URL('.', import.meta.url).pathname;
const segs = JSON.parse(fs.readFileSync(D + 'narration.json', 'utf8'));
const total = segs.join('').length;
if (total >= 1000) throw new Error('narration too long: ' + total);
const env = Object.fromEntries(fs.readFileSync(process.env.HOME + '/Documents/GitHub/temp/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
fs.mkdirSync(D + 'audio', { recursive: true });
let used = 'elevenlabs';
for (let i = 0; i < segs.length; i += 1) {
  const f = `${D}audio/p${i + 1}.mp3`;
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/s3TPKV1kjDlVtZbl4Ksh?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: segs[i], model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.1 } })
    });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); ok = true; }
    else {
      console.error('segment', i + 1, 'status', r.status);
      if (r.status === 429) await new Promise(res => setTimeout(res, 60000)); else break;
    }
  }
  if (!ok) {
    used = 'say';
    execFileSync('/usr/bin/say', ['-v', 'Daniel', '-o', `${D}audio/p${i + 1}.aiff`, segs[i]]);
    execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', `${D}audio/p${i + 1}.aiff`, f], { stdio: 'ignore' });
  }
  const d = execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
  fs.writeFileSync(`${D}audio/dur${i + 1}.txt`, d);
  console.log('p' + (i + 1), d + 's');
}
console.log('chars', total, 'voice', used);
