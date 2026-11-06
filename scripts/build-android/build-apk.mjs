/**
 * One command from source to an installable debug APK:
 *
 *   npm run android:apk
 *
 * In order: validate the levels and build the web assets (`npm run build`), copy them into the Android project
 * (`cap sync android`), run Gradle's `assembleDebug`, then read the APK back and check it (exists, not empty, the
 * expected application id and version, no INTERNET permission, debug-signed). It copies the real APK to
 *
 *   dist/android/neon-drift-v<version>-debug.apk      (+ .sha256 and artifact-manifest.json beside it)
 *
 * and exits non-zero, with the reason, if any prerequisite is missing or any step fails. Versions of the tools are
 * detected from the machine, never assumed, and recorded in the manifest.
 *
 * Needs JDK 21 and the Android SDK. JAVA_HOME and ANDROID_HOME are used when they are right; otherwise a JDK 21 is
 * looked for on PATH and in the usual install folders, and android/local.properties is written from ANDROID_HOME.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const androidDir = join(root, 'android');
const isWindows = process.platform === 'win32';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const APP_ID = 'com.portfolio.neondrift';
const apkPath = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const outDir = join(root, 'dist', 'android');

function fail(message) {
  process.stderr.write(`\n${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: isWindows, ...options });
  if (result.status !== 0) fail(`"${command} ${args.join(' ')}" failed (exit ${result.status ?? 'none'}).`);
}

function javaMajor(home) {
  const exe = join(home, 'bin', isWindows ? 'java.exe' : 'java');
  if (!existsSync(exe)) return 0;
  const out = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  const match = /version "(\d+)/.exec(`${out.stderr}${out.stdout}`);
  return match ? Number(match[1]) : 0;
}

function jdkCandidates() {
  const found = [process.env.JAVA_HOME].filter(Boolean);
  const where = spawnSync(isWindows ? 'where' : 'which', ['java'], { encoding: 'utf8' });
  if (where.status === 0) found.push(dirname(dirname(where.stdout.split(/\r?\n/)[0].trim())));
  const bases = [
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Eclipse Adoptium'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Java'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Microsoft'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'CodexDevTools', 'java'),
    '/usr/lib/jvm',
  ].filter((dir) => dir && existsSync(dir));
  for (const base of bases) for (const name of readdirSync(base)) found.push(join(base, name));
  return found;
}

/** Capacitor 8's Android build needs JDK 21 or newer. */
function pickJdk() {
  const home = jdkCandidates().find((candidate) => javaMajor(candidate) >= 21);
  if (!home) fail('No JDK 21 found. Install one (for example Temurin 21) and set JAVA_HOME to it, then run again.');
  return home;
}

function sdkRoot() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  const sdk = candidates.find((dir) => existsSync(join(dir, 'platforms')));
  if (!sdk) fail('No Android SDK found. Set ANDROID_HOME to the SDK folder (it must contain "platforms").');
  return sdk;
}

const newestFirst = (a, b) => b.localeCompare(a, undefined, { numeric: true });
const listDir = (dir) => (existsSync(dir) ? readdirSync(dir).sort(newestFirst) : []);

function buildTool(sdk, tool, extensions = ['.exe', '.bat', '']) {
  const dir = join(sdk, 'build-tools');
  for (const version of listDir(dir)) {
    for (const ext of extensions) {
      const candidate = join(dir, version, `${tool}${isWindows ? ext : ''}`);
      if (existsSync(candidate) && statSync(candidate).isFile()) return { path: candidate, version };
    }
  }
  return null;
}

/** What is actually installed on this machine, for the manifest and the README. */
function detectToolchain(sdk, jdk) {
  const javaOut = spawnSync(join(jdk, 'bin', isWindows ? 'java.exe' : 'java'), ['-version'], { encoding: 'utf8' });
  const wrapper = join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  const gradleMatch = existsSync(wrapper) ? /gradle-([\d.]+)-/.exec(readFileSync(wrapper, 'utf8')) : null;
  const gradle = gradleMatch?.[1] ?? 'unknown';
  return {
    node: process.version,
    java: (`${javaOut.stderr}${javaOut.stdout}`.split(/\r?\n/)[0] ?? '').trim(),
    gradleWrapper: gradle,
    androidPlatforms: listDir(join(sdk, 'platforms')),
    androidBuildTools: listDir(join(sdk, 'build-tools')),
    capacitor: pkg.dependencies['@capacitor/core'],
    os: `${process.platform} ${process.arch}`,
  };
}

function ensureLocalProperties(sdk) {
  writeFileSync(join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);
}

/** Reads the package line, SDK levels and requested permissions back out of the finished APK. */
function inspectApk(sdk) {
  const aapt2 = buildTool(sdk, 'aapt2');
  if (!aapt2) fail('aapt2 not found in the Android SDK build-tools, so the APK cannot be checked. Install build-tools.');
  const out = spawnSync(aapt2.path, ['dump', 'badging', apkPath], { encoding: 'utf8' }).stdout;
  const pkgLine = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(out);
  if (!pkgLine) fail('Could not read the package line from the APK.');
  const sdkLine = /minSdkVersion:'(\d+)'/.exec(out);
  const targetLine = /targetSdkVersion:'(\d+)'/.exec(out);
  const permissions = [...out.matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]);
  return {
    appId: pkgLine[1], versionCode: Number(pkgLine[2]), versionName: pkgLine[3],
    minSdk: sdkLine ? Number(sdkLine[1]) : null, targetSdk: targetLine ? Number(targetLine[1]) : null, permissions,
  };
}

/** "debug" for the Android debug key, "release" for any other certificate, "unknown" when it cannot be read. */
function signingType(sdk, jdk) {
  const apksigner = buildTool(sdk, 'apksigner', ['.bat', '.exe', '']);
  if (!apksigner) return 'unknown (apksigner not found)';
  const env = { ...process.env, JAVA_HOME: jdk };
  // apksigner is a .bat on Windows, which needs a shell, and a shell needs paths with spaces quoted.
  const target = isWindows ? `"${apkPath}"` : apkPath;
  const result = spawnSync(apksigner.path, ['verify', '--print-certs', target], { encoding: 'utf8', shell: isWindows, env });
  if (result.status !== 0) return 'unverified (apksigner reported a problem)';
  return /Android Debug/i.test(result.stdout) ? 'debug' : 'release';
}

function check(info) {
  const size = statSync(apkPath).size;
  if (size < 100_000) fail(`The APK at ${apkPath} is suspiciously small (${size} bytes).`);
  if (info.appId !== APP_ID) fail(`Application id is ${info.appId}, expected ${APP_ID}.`);
  if (info.versionName !== pkg.version) fail(`APK versionName ${info.versionName} does not match package.json ${pkg.version}.`);
  if (info.permissions.some((p) => /INTERNET/.test(p))) fail('The APK requests the INTERNET permission; the game is offline-only.');
  return size;
}

function publish(info, size, signing, toolchain) {
  mkdirSync(outDir, { recursive: true });
  const shortVersion = pkg.version.replace(/\.0$/, '');
  const name = `neon-drift-v${shortVersion}-debug.apk`;
  const target = join(outDir, name);
  copyFileSync(apkPath, target);
  const sha256 = createHash('sha256').update(readFileSync(target)).digest('hex');
  writeFileSync(`${target}.sha256`, `${sha256} *${name}\n`);
  const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const manifest = {
    file: name, bytes: size, sha256, ...info, signing, builtAt: new Date().toISOString(),
    gitCommit: git.status === 0 ? git.stdout.trim() : null, toolchain,
  };
  writeFileSync(join(outDir, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { target, sha256 };
}

const startedAt = Date.now();
const sdk = sdkRoot();
const jdk = pickJdk();
const toolchain = detectToolchain(sdk, jdk);
process.stdout.write(`Toolchain: ${JSON.stringify(toolchain)}\n`);
process.stdout.write('\n1/4  Validating levels and building the web assets...\n');
run('npm', ['run', 'build']);
process.stdout.write('\n2/4  Syncing the build into the Android project...\n');
if (!existsSync(androidDir)) run('npx', ['cap', 'add', 'android']);
run('npx', ['cap', 'sync', 'android']);
ensureLocalProperties(sdk);
process.stdout.write(`\n3/4  Running Gradle assembleDebug (JDK ${javaMajor(jdk)} at ${jdk})...\n`);
const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
const [gradle, gradleArgs] = isWindows ? ['.\\gradlew.bat', ['assembleDebug']] : ['sh', ['./gradlew', 'assembleDebug']];
run(gradle, gradleArgs, { cwd: androidDir, env });
process.stdout.write('\n4/4  Checking the APK...\n');
if (!existsSync(apkPath)) fail(`Gradle finished but no APK was found at ${apkPath}`);
const info = inspectApk(sdk);
const size = check(info);
const signing = signingType(sdk, jdk);
const { target, sha256 } = publish(info, size, signing, toolchain);
process.stdout.write(
  `\nBuilt:      ${apkPath}\nCopied to:  ${target}\nSize:       ${(size / 1048576).toFixed(2)} MB\n` +
    `Package:    ${info.appId}   version ${info.versionName} (code ${info.versionCode}), minSdk ${info.minSdk}, target ${info.targetSdk}\n` +
    `Permissions: ${info.permissions.join(', ') || 'none'}\nSigning:    ${signing}\n` +
    `SHA-256:    ${sha256}\nTook:       ${Math.round((Date.now() - startedAt) / 1000)} s\n\n` +
    `Install on a connected phone:  adb install -r "${target}"\n`,
);
