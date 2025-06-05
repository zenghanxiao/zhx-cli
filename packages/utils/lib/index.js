import { spawn } from 'child_process';
import isDebug from "./isDebug.js";
import log from './log.js';
import { getNpmRegistry, getNpmInfo, getLatestVersion, getNpmLatestSemverVersion } from "./npm.js";
import Package from "./Package.js";
import { makeList, makeInput, makePassword, makeConfirm } from './inquirer.js';
import request from './request.js';
import kebabCase from 'kebab-case';
import ejs from './ejs.js';

function sleep(timeout) {
  return new Promise((resolve => {
    setTimeout(resolve, timeout);
  }));
}

function printErrorLog (e, type) {
  if (isDebug()) {
    log.error(type, e)
  } else {
    log.error(type, e.message)
  }
}

function exec(command, args, options) {
  const win32 = process.platform === 'win32';

  const cmd = win32 ? 'cmd' : command;
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

  return spawn(cmd, cmdArgs, options || {});
}

function firstUpperCase(str) {
  return str.replace(/^\S/, s => s.toUpperCase());
}

function camelTrans(str, isBig) {
  let i = isBig ? 0 : 1;
  str = str.split('-');
  for (; i < str.length; i += 1) {
    str[i] = firstUpperCase(str[i]);
  }
  return str.join('');
}

function formatName(name) {
  if (name) {
    name = `${name}`.trim();
    if (name) {
      if (/^[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
        name = name.replace(/^[.*_\/\\()&^!@#$%+=?<>~`\s]+/g, '');
      }
      if (/^[0-9]+/.test(name)) {
        name = name.replace(/^[0-9]+/, '');
      }
      if (/[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
        name = name.replace(/[.*_\/\\()&^!@#$%+=?<>~`\s]/g, '-');
      }
      return camelTrans(name, true);
    } else {
      return name;
    }
  } else {
    return name;
  }
}

function formatClassName(name) {
  return kebabCase(name).replace(/^-/, '');
}

export {
  isDebug,
  log,
  getNpmRegistry,
  getNpmInfo,
  getLatestVersion,
  getNpmLatestSemverVersion,
  printErrorLog,
  exec,
  Package,
  makeList,
  makeInput,
  makePassword,
  makeConfirm,
  request,
  formatName,
  formatClassName,
  sleep,
  ejs
}