'use strict';

const fs = require('fs');
const path = require('path');

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

const resolveNextVersion = (localVersion, publishedVersion) => {
  const localSemver = parseSemver(localVersion);
  const candidates = [localSemver];

  if (publishedVersion) {
    candidates.push(parseSemver(publishedVersion));
  }

  const baseSemver = candidates.reduce((latest, candidate) =>
    compareSemver(candidate, latest) > 0 ? candidate : latest
  );

  const nextSemver = { ...baseSemver, patch: baseSemver.patch + 1 };
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

    const nextVersion = resolveNextVersion(pkg.version, process.env.PUBLISHED_VERSION || '');
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
