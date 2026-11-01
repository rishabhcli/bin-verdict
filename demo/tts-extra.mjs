// Generates one extra clip (demo/audio/p2b.mp3). Total narration across all clips stays under 1,000 characters.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const D = new URL('.', import.meta.url).pathname;
const text = 'Austin accepts coated paper cups. Portland does not.';
const main = JSON.parse(fs.readFileSync(D + 'narration.json', 'utf8')).join('').length;
if (main + text.length >= 1000) throw new Error('too long');
const env = Object.fromEntries(fs.readFileSync(process.env.HOME + '/Documents/GitHub/temp/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/s3TPKV1kjDlVtZbl4Ksh?output_format=mp3_44100_128', {
  method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.1 } })
});
if (!r.ok) throw new Error('status ' + r.status);
fs.writeFileSync(D + 'audio/p2b.mp3', Buffer.from(await r.arrayBuffer()));
const d = execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', D + 'audio/p2b.mp3']).toString().trim();
fs.writeFileSync(D + 'audio/dur2b.txt', d);
console.log('p2b', d + 's', 'total chars', main + text.length);
