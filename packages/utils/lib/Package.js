import path from 'node:path';
import fs from 'node:fs';
import fse from 'fs-extra';
import npminstall from 'npminstall';
import log from './log.js';
import { getNpmLatestSemverVersion, getNpmRegistry } from './npm.js';
import formatPath from './formatPath.js';

const useOriginNpm = true;

/**
 * Package 类，用于管理动态下载的库文件
 */
class Package {
  constructor(options) {
    log.verbose('Package options', options);
    this.targetPath = options.targetPath;
    this.storePath = options.storePath;
    this.packageName = options.name;
    this.packageVersion = options.version;
    this.npmFilePathPrefix = this.packageName.replace('/', '_');
  }

  get npmFilePath() {
    return path.resolve(this.storePath, this.packageName);
  }

  async prepare() {
    if (!fs.existsSync(this.targetPath)) {
      fse.mkdirpSync(this.targetPath);
    }
    if (!fs.existsSync(this.storePath)) {
      fse.mkdirpSync(this.storePath);
    }
    log.verbose(this.targetPath);
    log.verbose(this.storePath);
    const latestVersion = await getNpmLatestSemverVersion(this.packageName, this.packageVersion);
    log.verbose('latestVersion', this.packageName, latestVersion);
    if (latestVersion) {
      this.packageVersion = latestVersion;
    }
  }

  async exists() {
    await this.prepare();
    return fs.existsSync(this.npmFilePath);
  }

  getPackage(isOriginal = false) {
    if (!isOriginal) {
      return fse.readJSONSync(path.resolve(this.npmFilePath, 'package.json'));
    }
    return fse.readJSONSync(path.resolve(this.storePath, 'package.json'));
  }

  async install() {
    await this.prepare();
    return npminstall({
      root: this.targetPath,
      storeDir: this.storePath,
      registry: getNpmRegistry(useOriginNpm),
      pkgs: [{
        name: this.packageName,
        version: this.packageVersion,
      }],
    });
  }

  async getVersion() {
    await this.prepare();
    return await this.exists() ? this.getPackage().version : null;
  }

  async getLatestVersion() {
    const version = await this.getVersion();
    if (version) {
      const latestVersion = await getNpmLatestSemverVersion(this.packageName, version);
      return latestVersion;
    }
    return null;
  }

  async update() {
    const latestVersion = await this.getLatestVersion();
    return npminstall({
      root: this.targetPath,
      storeDir: this.storePath,
      registry: getNpmRegistry(useOriginNpm),
      pkgs: [{
        name: this.packageName,
        version: latestVersion,
      }],
    });
  }

  getRootFilePath(isOriginal = false) {
    const pkg = this.getPackage(isOriginal);
    if (pkg) {
      if (!isOriginal) {
        return formatPath(path.resolve(this.npmFilePath, pkg.main));
      }
      return formatPath(path.resolve(this.storePath, pkg.main));
    }
    return null;
  }
}

export default Package;
