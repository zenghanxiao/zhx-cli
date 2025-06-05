import path from 'node:path';
import { program } from 'commander';
import fse from 'fs-extra';
import { dirname } from 'dirname-filename-esm';
import semver from 'semver';
import chalk from 'chalk';
import rootCheck from 'root-check';
import userHome from 'user-home';
import { pathExists } from 'path-exists';
import { config } from 'dotenv';
import { log, getNpmLatestSemverVersion, Package, exec, isDebug, printErrorLog } from '@zhx-cli/utils';
import './exception.js';

const __dirname = dirname(import.meta);
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = fse.readJSONSync(pkgPath);

const LOWEST_NODE_VERSION = '14.0.0';
const DEFAULT_CLI_HOME = '.zhx-cli';
const NPM_NAME = '@zhx-cli/core';
const DEPENDENCIES_PATH = 'dependencies';

let envConfig;

function checkPkgVersion() {
  log.notice('cli', pkg.version);
}

function checkNodeVersion() {
  log.verbose('node version', process.version);
  if (!semver.gte(process.version, LOWEST_NODE_VERSION)) {
    throw new Error(chalk.red(`zhx-cli 需要安装 ${LOWEST_NODE_VERSION} 以上版本的Node.js`));
  }
}

function checkRoot() {
  rootCheck();
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(chalk.red('当前登录用户主目录不存在！'));
  }
}

function createCliConfig() {
  const conf = {
    home: userHome
  };
  if (process.env.CLI_HOME) {
    conf['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  } else {
    conf['cliHome'] = path.join(userHome, DEFAULT_CLI_HOME);
  }
  return conf;
}

function checkEnv() {
  const dotenvPath = path.resolve(userHome, '.env');
  if (pathExists(dotenvPath)) {
    config({
      path: dotenvPath
    });
  }
  envConfig = createCliConfig();
  log.verbose('环境变量', envConfig);
}


function checkArgs() {
  if (isDebug()) {
    process.env.LOG_LEVEL = 'verbose';
  } else {
    process.env.LOG_LEVEL = 'info';
  }
  log.level = process.env.LOG_LEVEL;
}

async function checkGlobalUpdate() {
  const curVer = pkg.version;
  const npmName = pkg.name
  const lastVersion = await getNpmLatestSemverVersion(npmName, curVer);
  if (lastVersion && semver.gt(lastVersion, curVer)) {
    log.warn('更新提示', chalk.yellow(`请手动更新 ${npmName}, 当前版本：${curVer}, 最新版本：${lastVersion}
      更新命令：npm install -g ${npmName}`));
  }
}

function prepare() {
  checkPkgVersion(); // 检查当前运行版本
  checkNodeVersion(); // 检查 node 版本
  checkRoot(); // 检查是否为 root 启动
  checkUserHome(); // 检查用户主目录
  checkEnv(); // 检查环境变量
  checkArgs();
  // await checkGlobalUpdate(); // 检查工具是否需要更新
}

function preAction() {
  log.verbose('zhx-cli pre action');
}

function handleError(e) {
  if (isDebug()) {
    log.error('Error:', e.stack);
  } else {
    log.error('Error:', e.message);
  }
  process.exit(1);
}

async function execCommand({ packagePath, packageName, packageVersion }, extraOptions) {
  let rootFile;
  try {
    if (packagePath) {
      const execPackage = new Package({
        targetPath: packagePath,
        storePath: packagePath,
        name: packageName,
        version: packageVersion,
      });
      rootFile = execPackage.getRootFilePath(true);
    } else {
      const { cliHome } = envConfig;
      const packageDir = `${DEPENDENCIES_PATH}`;
      const targetPath = path.resolve(cliHome, packageDir);
      const storePath = path.resolve(targetPath, 'node_modules');
      const initPackage = new Package({
        targetPath,
        storePath,
        name: packageName,
        version: packageVersion,
      });
      if (await initPackage.exists()) {
        await initPackage.update();
      } else {
        await initPackage.install();
      }
      rootFile = initPackage.getRootFilePath();
    }

    const _config = Object.assign({}, envConfig, extraOptions, {
      debug: isDebug()
    });

    if (fse.existsSync(rootFile)) {
      const code = `import('${rootFile}').then((obj) => { obj.default(${JSON.stringify(_config)}); })`;
      const p = exec('node', ['-e', code], { 'stdio': 'inherit' });
      p.on('error', e => {
        log.verbose('命令执行失败:', e);
        handleError(e);
        process.exit(1);
      });
      p.on('exit', c => {
        log.verbose('命令执行成功:', c);
        process.exit(c);
      });
    }
  } catch(e) {
    printErrorLog(e);
  }
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-e, --env <envName>', '获取环境变量名称')
    .hook('preAction', preAction);
  
  program
    .command('init [type]')
    .description('项目初始化')
    .option('--packagePath <packagePath>', '手动指定init包路径')
    .option('--force', '覆盖当前路径文件（谨慎使用）')
    .action(async (type, { packagePath, force }) => {
      const packageName = '@zhx-cli/core';
      const packageVersion = '0.0.11';
      await execCommand({ packagePath, packageName, packageVersion }, { type, force });
    });

  program.on('option:debug', function() {
    if (program.opts().debug) {
      log.verbose('debug', 'launch debug mode');
    }
  });

  program.on('command:*', function(obj) {
    log.error('未知的命令：' + obj[0]);
  });

  program.parse(process.argv);

  if (process.argv.length < 3) {
    program.outputHelp();
    console.log();
  }
}

function cli() {
  try {
    prepare();
    registerCommand();
  } catch (e) {
    log.error(e.message);
  }
}

export default cli;
