
import fs from 'node:fs';
import fse from 'fs-extra';
import path from 'node:path';
import ora from 'ora';
import { log, makeConfirm, makeList, makeInput, formatName, formatClassName, sleep, Package, ejs, exec } from '@zhx-cli/utils';
import getProjectTemplate from './getProjectTemplate.js';

const COMPONENT_FILE = '.componentrc';
const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';
const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const DEFAULT_TYPE = TYPE_PROJECT;

function getComponentDescription() {
  return makeInput({
    message: '请输入组件的描述信息',
    defaultValue: '',
  });
}

function getProjectVersion(defaultVersion, initType) {
  return makeInput({
    message: initType === TYPE_PROJECT ? '请输入项目版本号' : '请输入组件版本号',
    defaultValue: defaultVersion,
  });
}

function getInitType () {
  return makeList({
    choices: [{
      name: '项目',
      value: TYPE_PROJECT,
    }, {
      name: '组件',
      value: TYPE_COMPONENT,
    }],
    message: '请选择初始化类型',
    defaultValue: DEFAULT_TYPE
  })
}

function getProjectName(initType) {
  return makeInput({
    message: initType === TYPE_PROJECT ? '请输入项目名称' : '请输入组件名称',
    defaultValue: '',
  });
}

function createTemplateChoice(list) {
  return list.map(item => ({
    value: item.npmName,
    name: item.name,
  }));
}

// 如果是组件项目，则创建组件相关文件
async function createComponentFile(template, data, dir) {
  if (template.tag.includes(TYPE_COMPONENT)) {
    const componentData = {
      ...data,
      buildPath: template.buildPath,
      examplePath: template.examplePath,
      npmName: template.npmName,
      npmVersion: template.version,
    }
    const componentFile = path.resolve(dir, COMPONENT_FILE);
    fse.outputFileSync(componentFile, JSON.stringify(componentData));
  }
}

async function npminstall(targetPath) {
  return new Promise((resolve, reject) => {
    const p = exec('npm', ['install'], { stdio: 'inherit', cwd: targetPath });
    p.on('error', e => {
      reject(e);
    });
    p.on('exit', c => {
      resolve(c);
    });
  });
}

async function execStartCommand(targetPath, startCommand) {
  return new Promise((resolve, reject) => {
    const p = exec(startCommand[0], startCommand.slice(1), { stdio: 'inherit', cwd: targetPath });
    p.on('error', e => {
      reject(e);
    });
    p.on('exit', c => {
      resolve(c);
    });
  });
}

async function installTemplate(template, project, options) {
  // 安装模版
  let spinner = ora(`正在安装模板...`).start();
  const sourceDir = template.path;
  const targetDir = options.targetPath;
  fse.ensureDirSync(sourceDir);
  fse.ensureDirSync(targetDir);
  // if (fse.pathExistsSync(targetDir)) {
  //   if (!options.force) {
  //     log.error(`当前目录下已存在 ${targetDir} 文件夹`);
  //     return;
  //   } else {
  //     fse.removeSync(targetDir);
  //     fse.ensureDirSync(targetDir);
  //   }
  // } else {
  //   fse.ensureDirSync(targetDir);
  // }
  fse.copySync(sourceDir, targetDir);
  spinner.stop();
  log.success('模板安装成功');

  // ejs 模板渲染
  const ejsIgnoreFiles = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/.DS_Store',
  ];
  if (template.ignore) {
    ejsIgnoreFiles.push(...template.ignore);
  }
  log.verbose('ejsData', ejsData);
  await ejs(targetDir, ejsData, {
    ignore: ejsIgnoreFiles,
  });
  // 如果是组件，则进行特殊处理
  await createComponentFile(template, ejsData, targetDir);
  // 安装依赖文件
  log.notice('开始安装依赖');
  await npminstall(targetDir);
  log.success('依赖安装成功');
  // 启动代码
  if (template.startCommand) {
    log.notice('开始执行启动命令');
    const startCommand = template.startCommand.split(' ');
    await execStartCommand(targetDir, startCommand);
  }
}

function execCustomTemplate(rootFile, options) {
  const code = `import('${rootFile}').then((obj) => { obj.default(${JSON.stringify(options)}); });`;
  return new Promise((resolve, reject) => {
    const p = exec('node', ['-e', code], { 'stdio': 'inherit' });
    p.on('error', e => {
      reject(e);
    });
    p.on('exit', c => {
      resolve(c);
    });
  });
}

async function installCustomTemplate(template, ejsData, options) {
  const pkgPath = path.resolve(template.sourcePath, 'package.json');
  const pkg = fse.readJsonSync(pkgPath);
  const rootFile = path.resolve(template.sourcePath, pkg.main);
  if (!fs.existsSync(rootFile)) {
    throw new Error('入口文件不存在！');
  }
  log.notice('开始执行自定义模板');
  const targetPath = options.targetPath;
  await execCustomTemplate(rootFile, {
    targetPath,
    data: ejsData,
    template,
  });
  log.success('自定义模板执行成功');
}

async function downloadTemplate(templateList, options) {
  // 用户交互选择
  const templateName = await makeList({
    choices: createTemplateChoice(templateList),
    message: '请选择模板'
  });
  log.verbose('template', templateName);
  const selectedTemplate = templateList.find(item => item.npmName === templateName);
  log.verbose('selected template', selectedTemplate);
  const { cliHome } = options;
  const targetPath = path.resolve(cliHome, 'template');
  // 基于模板生成 Package 对象
  const templatePkg = new Package({
    targetPath,
    storePath: path.resolve(targetPath, 'node_modules'),
    name: selectedTemplate.npmName,
    version: selectedTemplate.version,
  });
  // 如果模板不存在则进行下载
  if (!await templatePkg.exists()) {
    let spinner = ora(`正在下载模板...`).start();
    // await sleep(1000);
    await templatePkg.install();
    spinner.stop(true);
    log.success('下载模板成功');
  } else {
    log.notice('模板已存在', `${selectedTemplate.npmName}`);
    log.notice('模板路径', `${targetPath}`);
    let spinner = ora(`开始更新模板...`).start();
    // await sleep(1000);
    await templatePkg.update();
    spinner.stop(true);
    log.success('更新模板成功');
  }
  // 生成模板路径
  const templateSourcePath = templatePkg.npmFilePath;
  const templatePath = path.resolve(templateSourcePath, 'template');
  log.verbose('template path', templatePath);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`[${templateName}]项目模板不存在！`);
  }
  const template = {
    ...selectedTemplate,
    path: templatePath,
    sourcePath: templateSourcePath,
  };
  return template;
}

async function prepare(options) {
  let fileList = fs.readdirSync(process.cwd());
  fileList = fileList.filter(file => ['node_modules', '.git', '.DS_Store'].indexOf(file) < 0);
  log.verbose('fileList', fileList);

  let continueWhenDirNotEmpty = true;
  if (fileList && fileList.length > 0) {
    continueWhenDirNotEmpty = await makeConfirm({
      message: '当前文件夹不为空，是否继续创建项目？',
      defaultValue: false,
    });
  }
  if (!continueWhenDirNotEmpty) {
    return;
  }

  if (options.force) {
    const targetDir = options.targetPath;
    const confirmEmptyDir = await makeConfirm({
      message: '是否确认清空当下目录下的文件',
      defaultValue: false,
    });
    if (confirmEmptyDir) {
      fse.emptyDirSync(targetDir);
    }
  }

  let initType = await getInitType();
  log.verbose('initType', initType);

  let templateList = await getProjectTemplate();
  if (!templateList || templateList.length === 0) {
    throw new Error('项目模板列表获取失败');
  }

  let projectName = '';
  let className = '';
  while (!projectName) {
    projectName = await getProjectName(initType);
    if (projectName) {
      projectName = formatName(projectName);
      className = formatClassName(projectName);
    }
    log.verbose('name', projectName);
    log.verbose('className', className);
  }

  let version = '1.0.0';
  do {
    version = await getProjectVersion(version, initType);
    log.verbose('version', version);
  } while (!version);

  if (initType === TYPE_PROJECT) {
    templateList = templateList.filter(item => item.tag.includes('project'));
    return {
      templateList,
      project: {
        name: projectName,
        className,
        version,
      },
    };
  } else {
    templateList = templateList.filter(item => item.tag.includes('component'));
    let description = '';
    while (!description) {
      description = await getComponentDescription();
      log.verbose('description', description);
    }
    return {
      templateList,
      project: {
        name: projectName,
        className,
        version,
        description,
      },
    };
  }
}

export default async function init(options) {
  try {
    let targetPath = process.cwd();
    if (!options.targetPath) {
      options.targetPath = targetPath
    }
    log.verbose('init', options);

    // 完成项目初始化的准备和校验工作
    const result = await prepare(options);
    if (!result) {
      log.info('创建项目终止');
      return;
    }
    // 获取项目模板列表
    const { templateList, project } = result;
    // 缓存项目模板文件
    const template = await downloadTemplate(templateList, options);
    log.verbose('template', template);

    if (template.type === TEMPLATE_TYPE_NORMAL) {
      // 安装项目模板
      await installTemplate(template, project, options);
    } else if (template.type === TEMPLATE_TYPE_CUSTOM) {
      await installCustomTemplate(template, project, options);
    } else {
      throw new Error('未知的模板类型！');
    }
  } catch (e) {
    if (options.debug) {
      log.error('Error:', e.stack);
    } else {
      log.error('Error:', e.message);
    }
  } finally {
    process.exit(0);
  }
}
