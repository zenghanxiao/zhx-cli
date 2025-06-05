import axios from 'axios';
import urlJoin from 'url-join';
import semver from 'semver';
import log from './log.js';

export function getNpmRegistry(isOriginal = true) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npmmirror.com';
}

// 从 registry 获取 npm 的信息
export function getNpmInfo(npm, registry) {
  const reg = registry || getNpmRegistry();
  const url = urlJoin(reg, npm);
  return axios.get(url).then(function(response) {
    try {
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      return Promise.reject(error);
    }
  });
}

// 获取某个 npm 的最新版本号
export function getLatestVersion(npm, registry) {
  return getNpmInfo(npm, registry).then(function (data) {
    if (!data['dist-tags'] || !data['dist-tags'].latest) {
      log.error('没有 latest 版本号', data);
      return Promise.reject(new Error('Error: 没有 latest 版本号'));
    }
    const latestVersion = data['dist-tags'].latest;
    return latestVersion;
  });
}

// 获取某个 npm 的所有版本号
function getVersions(npm, registry) {
  return getNpmInfo(npm, registry).then(function (body) {
    const versions = Object.keys(body.versions);
    return versions;
  });
}

// 根据指定 version 获取符合 semver 规范的最新版本号
function getLatestSemverVersion(baseVersion, versions) {
  versions = versions
    .filter(function (version) { return semver.satisfies(version, "^" + baseVersion); })
    .sort(function (a, b) {
      return semver.gt(b, a);
    });
  return versions[0];
}

// 根据指定 version 和包名获取符合 semver 规范的最新版本号
export function getNpmLatestSemverVersion(npm, baseVersion, registry) {
  return getVersions(npm, registry).then(function (versions) {
    return getLatestSemverVersion(baseVersion, versions);
  });
}
