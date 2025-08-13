#!/usr/bin/env node

// import {execute} from '@oclif/core'

// await execute({dir: import.meta.url})

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import MultiProgress from 'multi-progress';
import { m3u8 } from './m3u8';

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

const multi = new MultiProgress(process.stdout);
function createBar(label: string) {
    return multi.newBar(` ${label} [:bar] :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 30,
        total: 100
    });
}

(async () => {
    const dbar = createBar('下载中...');
    const cbar = createBar('合并中...');

    await m3u8.download({
        url: args.url,
        target: args.output,
        onDownload(args) {
            dbar.update(args.progress);
        },
        onCombine(args) {
            cbar.update(args.progress);
        }
    });
})();
