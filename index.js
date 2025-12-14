#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs-extra';
import app from './app.js';

const pkg = fs.readJsonSync(new URL('./package.json', import.meta.url));

program
  .version(pkg.version, '-v, --version')
  .name('s-cli-srsf')
  .description('自定义脚手架工具');

program
  .command('create [app-name]')
  .description('创建一个新的项目')
  .action(app);

program.parse(process.argv);

