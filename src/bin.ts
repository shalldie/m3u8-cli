#!/usr/bin/env node

// import {execute} from '@oclif/core'

// await execute({dir: import.meta.url})

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import MultiProgress from 'multi-progress';

const multi = new MultiProgress(process.stdout);

// const dbar = multi.newBar(` ${label} [:bar] :rate/bps :percent :etas`, {
//     complete: '=',
//     incomplete: ' ',
//     width: 30
//     // total: total || 1024 * 1024 * 1024 * 10
// });

let dbar: ProgressBar;
let cbar: ProgressBar;

interface IOptions {
    url: string;
    output: string;
}

const args: IOptions = yargs(hideBin(process.argv))
    .example(
        //
        'm3u8-cli download -u [url] -o [output]',
        ''
    )
    .alias('h', 'help')
    .alias('v', 'version')
    .alias('u', 'url')
    .demandOption('u')
    .describe('u', '下载地址')
    .alias('o', 'output')
    .demandOption('o')
    .describe('o', '保存到的文件')
    .parse() as any;

(async () => {
    console.log(args);
})();
