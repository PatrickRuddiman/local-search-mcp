import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const parseSemver = (version) => {
  const match = semverPattern.exec(version);
  if (!match) {
    throw new Error(`Version '${version}' is not valid semver in the form MAJOR.MINOR.PATCH.`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const compareSemver = (a, b) => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
};

const extractSemver = (value) => {
  if (!value) {
    return '';
  }

  const maybeSemvers = String(value)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reverse();

  for (const candidate of maybeSemvers) {
    if (semverPattern.test(candidate)) {
      return candidate;
    }
  }

  return '';
};

const fetchPublishedVersion = (packageName) => {
  if (!packageName) {
    return '';
  }

  try {
    const result = execSync(`npm view ${packageName} version`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return extractSemver(result);
  } catch (error) {
    return '';
  }
};

const resolveNextVersion = (localVersion, publishedVersion, bumpType) => {
  const localSemver = parseSemver(localVersion);
  const candidates = [localSemver];

  const normalizedPublished = extractSemver(publishedVersion);
  if (normalizedPublished) {
    candidates.push(parseSemver(normalizedPublished));
  }

  const baseSemver = candidates.reduce((latest, candidate) =>
    compareSemver(candidate, latest) > 0 ? candidate : latest
  );

  const nextSemver = { ...baseSemver };
  switch (bumpType) {
    case 'major':
      nextSemver.major += 1;
      nextSemver.minor = 0;
      nextSemver.patch = 0;
      break;
    case 'minor':
      nextSemver.minor += 1;
      nextSemver.patch = 0;
      break;
    default:
      nextSemver.patch += 1;
      break;
  }

  return `${nextSemver.major}.${nextSemver.minor}.${nextSemver.patch}`;
};

const updatePackageLock = (lockPath, nextVersion) => {
  if (!fs.existsSync(lockPath)) {
    return;
  }

  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  let updated = false;

  if (lock.version && lock.version !== nextVersion) {
    lock.version = nextVersion;
    updated = true;
  }

  if (lock.packages && lock.packages[''] && lock.packages[''].version && lock.packages[''].version !== nextVersion) {
    lock.packages[''].version = nextVersion;
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
};

const main = () => {
  try {
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const bumpType = (process.env.BUMP_TYPE || 'patch').toLowerCase();
    if (!['major', 'minor', 'patch'].includes(bumpType)) {
      throw new Error(`Unsupported bump type '${bumpType}'. Expected one of major, minor, or patch.`);
    }

    const publishedVersion = process.env.PUBLISHED_VERSION || fetchPublishedVersion(pkg.name);
    const nextVersion = resolveNextVersion(pkg.version, publishedVersion, bumpType);
    pkg.version = nextVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    updatePackageLock(path.resolve('package-lock.json'), nextVersion);

    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
      throw new Error('GITHUB_OUTPUT environment variable must be set.');
    }

    fs.appendFileSync(outputPath, `version=${nextVersion}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

main();
