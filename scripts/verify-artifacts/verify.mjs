/**
 * Checks the finished artifacts from the outside, without trusting the build script's own report:
 *
 *   npm run build && npm run android:apk && npm run verify:artifacts
 *
 * Web build:  dist/index.html exists, loads its scripts with relative paths (so it works from any static host or from
 *             the Android WebView), references no absolute or remote URL, and contains no unresolved process.env or
 *             dev inspector.
 * Android:    the APK exists, is not empty, its SHA-256 matches the manifest, its package, version, SDK levels and
 *             permissions are read straight back out of it with aapt2, and it is signed (debug is reported as debug).
 * Exits non-zero on any problem and prints exactly what is wrong.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];
const notes = [];
const expect = (ok, message) => {
  if (!ok) problems.push(message);
};

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'android' && dir === join(root, 'dist')) continue;
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

function checkWeb() {
  const index = join(root, 'dist', 'index.html');
  expect(existsSync(index), 'dist/index.html is missing: run `npm run build` first');
  if (!existsSync(index)) return;
  const html = readFileSync(index, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  expect(refs.length > 0, 'index.html references no scripts or styles');
  for (const ref of refs) expect(ref.startsWith('./'), `index.html uses a non-relative path: ${ref}`);
  const files = walk(join(root, 'dist'));
  const scripts = files.filter((f) => f.endsWith('.js'));
  expect(scripts.length > 0, 'no JavaScript bundle in dist/');
  for (const file of scripts) {
    const text = readFileSync(file, 'utf8');
    expect(!/process\.env/.test(text), `unresolved process.env in ${file}`);
    expect(!text.includes('__nd'), `the dev inspector leaked into ${file}`);
  }
  const bytes = files.reduce((sum, f) => sum + statSync(f).size, 0);
  notes.push(`web build: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB, served with relative paths`);
}

function aapt2() {
  const sdk = process.env.ANDROID_HOME;
  if (!sdk) return null;
  const dir = join(sdk, 'build-tools');
  if (!existsSync(dir)) return null;
  const versions = readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const ext = process.platform === 'win32' ? '.exe' : '';
  return versions.map((v) => join(dir, v, `aapt2${ext}`)).find((p) => existsSync(p)) ?? null;
}

function checkApk() {
  const dir = join(root, 'dist', 'android');
  const manifestPath = join(dir, 'artifact-manifest.json');
  expect(existsSync(manifestPath), 'dist/android/artifact-manifest.json is missing: run `npm run android:apk` first');
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const apk = join(dir, manifest.file);
  expect(existsSync(apk), `the APK ${manifest.file} named in the manifest does not exist`);
  if (!existsSync(apk)) return;
  const size = statSync(apk).size;
  expect(size > 1_000_000, `the APK is only ${size} bytes`);
  expect(size === manifest.bytes, `size ${size} differs from the manifest (${manifest.bytes})`);
  const sha = createHash('sha256').update(readFileSync(apk)).digest('hex');
  expect(sha === manifest.sha256, 'the APK SHA-256 does not match the manifest');
  const tool = aapt2();
  if (!tool) return notes.push('Android: aapt2 not found (set ANDROID_HOME), package metadata was NOT re-read from the APK');
  const out = spawnSync(tool, ['dump', 'badging', apk], { encoding: 'utf8' }).stdout;
  const line = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(out);
  expect(line !== null, 'could not read the package line from the APK');
  if (!line) return;
  expect(line[1] === 'com.portfolio.neondrift', `application id is ${line[1]}`);
  expect(line[3] === pkg.version, `APK version ${line[3]} differs from package.json ${pkg.version}`);
  const permissions = [...out.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]);
  expect(!permissions.some((p) => /INTERNET/.test(p)), 'the APK requests the INTERNET permission');
  const min = /minSdkVersion:'(\d+)'/.exec(out)?.[1];
  const target = /targetSdkVersion:'(\d+)'/.exec(out)?.[1];
  notes.push(`Android: ${manifest.file}, ${(size / 1048576).toFixed(2)} MB, ${line[1]} ${line[3]} (code ${line[2]}), ` +
    `minSdk ${min}, target ${target}, permissions [${permissions.join(', ')}], signing ${manifest.signing}`);
  notes.push(`Android: SHA-256 ${sha}`);
}

checkWeb();
checkApk();
for (const note of notes) console.log(`  ✓ ${note}`);
for (const problem of problems) console.log(`  ✗ ${problem}`);
console.log(problems.length === 0 ? '\nArtifacts verified.' : `\n${problems.length} problem(s).`);
process.exit(problems.length === 0 ? 0 : 1);
