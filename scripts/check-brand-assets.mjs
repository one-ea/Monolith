#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'client', 'public');
const failures = [];
const checks = [];

function pass(message) {
  checks.push({ ok: true, message });
}
function fail(message) {
  failures.push(message);
  checks.push({ ok: false, message });
}
function expectedFile(name) {
  return path.join(publicDir, name);
}

async function requireFile(name) {
  try {
    await access(expectedFile(name));
    pass(`${name} exists`);
    return true;
  } catch {
    fail(`${name} is missing`);
    return false;
  }
}

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function checkPng(name, width, height) {
  if (!(await requireFile(name))) return;
  const buffer = await readFile(expectedFile(name));
  const dimensions = pngDimensions(buffer);
  if (!dimensions) {
    fail(`${name} is not a valid PNG`);
    return;
  }
  if (dimensions.width !== width || dimensions.height !== height) {
    fail(`${name} is ${dimensions.width}x${dimensions.height}; expected ${width}x${height}`);
    return;
  }
  pass(`${name} dimensions are ${width}x${height}`);
}

async function checkSvg(name, viewBox, requiredTokens) {
  if (!(await requireFile(name))) return;
  const source = await readFile(expectedFile(name), 'utf8');
  if (!source.trimStart().startsWith('<svg')) fail(`${name} does not start with an SVG root`);
  if (!source.includes(`viewBox="${viewBox}"`)) fail(`${name} has an unexpected viewBox; expected ${viewBox}`);
  for (const token of requiredTokens) {
    if (!source.includes(token)) fail(`${name} is missing required token ${token}`);
  }
  if (!failures.some((entry) => entry.startsWith(`${name} `))) pass(`${name} structure and tokens are valid`);
}

await checkPng('favicon.png', 32, 32);
await checkPng('icon-192.png', 192, 192);
await checkPng('icon-512.png', 512, 512);
await checkPng('og-default.png', 1200, 630);
await checkSvg('monolith-logo.svg', '0 0 512 512', ['#0d1117', '#f0f6fc', '#4493f8']);
await checkSvg('monolith-logo-light.svg', '0 0 512 512', ['#f6f8fa', '#24292f', '#0969da']);
await checkSvg('monolith-logo-mono.svg', '0 0 512 512', ['currentColor']);
await checkSvg('monolith-lockup.svg', '0 0 960 256', ['MONOLITH']);
await checkSvg('monolith-og.svg', '0 0 1200 630', ['#0d1117', '#4493f8']);

for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.message}`);
if (failures.length) {
  console.error(`\n${failures.length} brand asset check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll brand asset checks passed.');
}
