import shell from 'shelljs';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';
import inquirer from 'inquirer';

// 仓库路径（使用 git clone，会自动拼接为 git@github.com:shuirongshuifu/base-admin.git）
const TEMPLATE_REPO = 'shuirongshuifu/base-admin';

const app = async (name) => {
  // 检查 git
  if (!shell.which('git')) {
    console.log(chalk.red('❌ 请先安装 git'));
    shell.exit(1);
  }

  // 如果没有提供项目名称，则询问用户
  let projectName = name;
  if (!projectName) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: '请输入项目名称:',
        validate: (val) => {
          if (!val.trim()) {
            return '项目名称不能为空';
          }
          if (val.match(/[\u4E00-\u9FFF`~!@#$%&^*[\]()\\;:<.>/?]/g)) {
            return '项目名称不能包含中文字符或特殊符号';
          }
          return true;
        }
      }
    ]);
    projectName = answer.projectName.trim();
  }

  // 验证项目名称
  if (projectName.match(/[\u4E00-\u9FFF`~!@#$%&^*[\]()\\;:<.>/?]/g)) {
    console.log(chalk.red('❌ 项目名称不能包含中文字符或特殊符号'));
    return;
  }

  // 处理同名文件夹
  if (fs.existsSync(projectName)) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `文件夹 ${projectName} 已存在，是否覆盖？`,
        default: false
      }
    ]);
    if (answer.overwrite) {
      await fs.remove(projectName);
      console.log(chalk.yellow(`已删除文件夹: ${projectName}`));
    } else {
      console.log(chalk.red('❌ 项目创建已取消'));
      return;
    }
  }

  // 拉取 Git 仓库 - 使用 git clone
  const spinner = ora('正在拉取项目...').start();

  // 使用 SSH URL (可以换成https)
  const repoUrl = `git@github.com:${TEMPLATE_REPO}.git`;
  const cloneResult = shell.exec(`git clone ${repoUrl} ${projectName}`, { silent: false });

  if (cloneResult.code !== 0) {
    spinner.fail(chalk.red('拉取失败'));
    console.log(chalk.red('错误信息：' + cloneResult.stderr));
    console.log(chalk.yellow('\n提示：请确保已配置 SSH key，或检查网络连接'));
    shell.exit(1);
  }

  // 删除 .git 文件夹（不保留 git 历史）
  const gitPath = path.join(projectName, '.git');
  if (fs.existsSync(gitPath)) {
    await fs.remove(gitPath);
  }

  spinner.succeed(chalk.green('拉取成功'));

  const projectPath = path.resolve(process.cwd(), projectName);

  // 处理 ejs 模板文件
  console.log(chalk.cyan('正在处理模板文件...'));
  const processEjsFiles = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
        processEjsFiles(filePath);
      } else if (file.endsWith('.ejs')) {
        const template = fs.readFileSync(filePath, 'utf-8');
        const rendered = ejs.render(template, { projectName });
        const destPath = filePath.replace(/\.ejs$/, '');
        fs.writeFileSync(destPath, rendered, 'utf-8');
        fs.unlinkSync(filePath);
      }
    });
  };
  processEjsFiles(projectPath);
  console.log(chalk.green('✅ 模板文件处理完成'));

  // 修改 package.json
  console.log(chalk.cyan('正在修改 package.json...'));
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = await fs.readJson(pkgPath);
  pkg.name = projectName;
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  console.log(chalk.green('✅ package.json 修改完成'));

  // 安装依赖
  console.log(chalk.cyan('正在安装依赖...'));
  const installResult = shell.exec(`cd ${projectName} && npm install`);
  if (installResult.code !== 0) {
    console.log(chalk.red('❌ 依赖安装失败'));
    console.log(chalk.red('错误信息：' + installResult.stderr));
    console.log(chalk.yellow('请手动进入项目目录执行：npm install'));
    shell.exit(1);
  }

  console.log(chalk.green('✅ 项目创建完成！'));

  // 询问是否立即启动项目
  const startAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'start',
      message: '是否立即启动项目？',
      default: true
    }
  ]);

  if (startAnswer.start) {
    console.log(chalk.cyan('\n正在启动项目...'));
    console.log(chalk.yellow('提示：按 Ctrl+C 可以停止开发服务器\n'));

    // 启动开发服务器（使用 async: true 让命令在后台运行，但保持输出）
    const devProcess = shell.exec(`cd ${projectName} && npm run dev`, {
      async: true,
      silent: false  // 显示输出
    });

    // 注意：dev 服务器会持续运行，用户需要手动停止
  } else {
    console.log(chalk.cyan(`\n要启动项目，请执行：`));
    console.log(chalk.green(`  cd ${projectName}`));
    console.log(chalk.green(`  npm run dev`));
  }
};

export default app;