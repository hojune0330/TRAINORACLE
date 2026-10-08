import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const prompts = JSON.parse(fs.readFileSync(path.join(here, 'prompts.json'), 'utf8'));
const ffmpeg = 'C:/Users/admin/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe';
const ffprobe = 'C:/Users/admin/AppData/Local/Microsoft/WinGet/Links/ffprobe.exe';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inspect = file => {
  const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', file], { encoding: 'utf8' }));
  const { width, height, pix_fmt: pixelFormat } = probe.streams[0];
  const raw = execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
  let transparent = 0, partial = 0, opaque = 0, edgeAlphaPixels = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = raw[(y * width + x) * 4 + 3];
    if (alpha === 0) transparent++; else if (alpha === 255) opaque++; else partial++;
    if (alpha > 0 && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) edgeAlphaPixels++;
    if (alpha > 16) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  return { width, height, pixelFormat, bytes: fs.statSync(file).size, sha256: hash(file), alpha: { transparent, partial, opaque, edgeAlphaPixels, visibleBounds: [minX, minY, maxX, maxY] } };
};

const results = [];
for (const asset of prompts.assets) {
  const original = path.join(root, asset.original), output = path.join(root, asset.public);
  if (!fs.existsSync(original)) fs.copyFileSync(asset.generatedSource, original, fs.constants.COPYFILE_EXCL);
  else if (hash(original) !== hash(asset.generatedSource)) throw new Error(`Existing source differs: ${original}`);
  if (fs.existsSync(output)) throw new Error(`Output already exists; inspect before replacing: ${output}`);
  execFileSync(ffmpeg, ['-v', 'error', '-n', '-i', original, '-vf', 'scale=256:256:flags=lanczos,format=rgba', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '84', '-compression_level', '6', output]);
  const record = { axis: asset.axis, original: asset.original, source: inspect(original), public: asset.public, derivative: inspect(output) };
  if (record.derivative.bytes >= 25000 || record.derivative.alpha.edgeAlphaPixels !== 0 || record.derivative.alpha.transparent === 0) throw new Error(`Asset QA failed: ${asset.axis}`);
  results.push(record);
}

const inputs = prompts.assets.flatMap(asset => ['-i', path.join(root, asset.public)]);
for (const size of [256, 80]) {
  const filters = prompts.assets.map((_, index) => `[${index}:v]scale=${size}:${size}:flags=lanczos,format=rgba[v${index}]`).join(';');
  const stack = `[v0][v1][v2][v3][v4][v5]xstack=inputs=6:layout=0_0|${size}_0|${size * 2}_0|0_${size}|${size}_${size}|${size * 2}_${size}:fill=0xF7F5EF[out]`;
  execFileSync(ffmpeg, ['-v', 'error', '-n', ...inputs, '-filter_complex', `${filters};${stack}`, '-map', '[out]', '-frames:v', '1', path.join(here, `contact-sheet-${size}px.png`)]);
}
console.log(JSON.stringify(results, null, 2));
