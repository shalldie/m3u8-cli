#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import MultiProgress from 'multi-progress';
import { m3u8 } from './m3u8';
import { bootstrap } from 'global-agent';

interface IOptions {
    url: string;
    output: string;
    proxy?: string;
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
    .alias('p', 'proxy')
    .describe('p', '使用的代理地址')
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
    if (args.proxy) {
        bootstrap();
        global.GLOBAL_AGENT.HTTP_PROXY = args.proxy;
    }

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
