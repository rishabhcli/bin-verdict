// Combines demo/raw/*.webm with narration into the final mp4 using demo/marks.json.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const D = new URL('.', import.meta.url).pathname;
const out = process.argv[2] ?? D + 'bin-verdict-demo.mp4';
const m = JSON.parse(fs.readFileSync(D + 'marks.json', 'utf8'));
const names = ['p1', 'p2', 'p2b', 'p3', 'p4', 'p5', 'p6'];
const durs = names.map(n => parseFloat(fs.readFileSync(`${D}audio/dur${n.slice(1)}.txt`, 'utf8')));
const total = Math.max(m.end, ...names.map((n, i) => m[n] + durs[i])) + 0.8;
const af = names.map((n, i) => `[${i + 1}:a]adelay=${Math.round(m[n] * 1000)}|${Math.round(m[n] * 1000)}[a${i}]`).join(';') + ';' +
  names.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${names.length}:duration=longest:normalize=0[a]`;
const args = ['-y', '-ss', m.offset.toFixed(3), '-i', m.video, ...names.flatMap(n => ['-i', `${D}audio/${n}.mp3`]),
  '-filter_complex', `[0:v]fps=30,format=yuv420p[v];${af}`, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2),
  '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];
console.log('total seconds', total.toFixed(1));
execFileSync('/opt/homebrew/bin/ffmpeg', args, { stdio: 'inherit' });
