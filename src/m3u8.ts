import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { fetch } from 'undici';
import { rimraf } from 'rimraf';
import { Parser as m3u8Parser } from 'm3u8-parser';
import { parallelLimit, reject } from 'async';

const ParallelMaxLimit = 8;

// const obj = {
//     headers: {
//         referer: '',
//         origin: '',
//         'user-agent':
//             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
//     }
// };

interface IDownloadOptions {
    url: string;
    target: string;
    onDownload?: (args: { progress: number; total: number }) => void;
    onCombine?: (args: { progress: number; total: number }) => void;
}

class M3U8 {
    async download(options: IDownloadOptions) {
        const muInfo = await this.parseFromUrl(options.url);
        const tempDir = path.join(path.dirname(options.target), `temp_m3u8_` + muInfo.md5);

        await fs.promises.mkdir(tempDir, { recursive: true });

        const segments = muInfo.segments.map(n => n.url);

        const fileList = await this.downloadSegments(segments, tempDir, options.onDownload);
        await this.combineFiles(fileList, options.target, options.onCombine);

        await rimraf(tempDir);
    }

    async parseFromUrl(
        url: string
    ): Promise<{ md5: string; txt: string; segments: { url: string; duration: number }[] }> {
        const muAb = await fetch(url).then(n => n.arrayBuffer());
        const muBytes = Buffer.from(muAb);
        const muTxt = muBytes.toString();

        // md5
        const hash = crypto.createHash('md5');
        hash.update(muBytes);
        const md5 = hash.digest('hex');

        // m3u8 parser
        const parser = new m3u8Parser();
        parser.push(muTxt);
        parser.end();

        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

        const manifest = parser.manifest;
        // 选择第一个数据源
        const firstPlayUri = manifest.playlists?.[0]?.['uri'];
        if (firstPlayUri && !manifest.segments.length) {
            return this.parseFromUrl(new URL(firstPlayUri, baseUrl).href);
        }

        const segments = manifest.segments.map(seg => {
            return {
                url: new URL(seg.uri, baseUrl).href,
                duration: seg.duration
            };
        });

        return {
            md5,
            txt: muTxt,
            segments
        };
    }

    private async downloadSingleSeg(segUrl: string, targetFile: string) {
        // 如果支持 HEAD， 判断是否可以跳过下载
        try {
            if (fs.existsSync(targetFile)) {
                // 使用 HEAD 方法，避免下载响应体
                const res = await fetch(segUrl, { method: 'HEAD' });
                const contentLength = res.headers.get('content-length');

                const buf = await fs.promises.readFile(targetFile);

                // 文件已下载
                if (buf.length.toString() === contentLength) {
                    return;
                }
            }
        } finally {
        }

        // 需要重新下载
        let maxReties = 5; // 重试次数
        await (async function invokeDownload() {
            try {
                if (fs.existsSync(targetFile)) {
                    await fs.promises.rm(targetFile);
                }
                const aBuf = await fetch(segUrl).then(n => n.arrayBuffer());
                await fs.promises.writeFile(targetFile, Buffer.from(aBuf));
            } catch (ex) {
                // 下载异常，再次执行
                if (--maxReties > 0) {
                    invokeDownload();
                    return;
                }
                return Promise.reject(ex);
            }
        })();
    }

    async downloadSegments(segments: string[], targetDir: string, onProgress?: IDownloadOptions['onDownload']) {
        let doneNum = 0;
        onProgress?.({
            progress: 0,
            total: segments.length
        });
        const fileList = await parallelLimit<string, string[]>(
            segments.map((segUrl, segIndex) => {
                return async () => {
                    const targetFile = path.join(targetDir, `segment_${segIndex}.ts`);
                    await this.downloadSingleSeg(segUrl, targetFile);

                    onProgress?.({
                        progress: ++doneNum / segments.length,
                        total: segments.length
                    });

                    return targetFile;
                };
            }),
            ParallelMaxLimit
        );
        onProgress?.({
            progress: 1,
            total: segments.length
        });
        return fileList;
    }

    async combineFiles(fileList: string[], targetFile: string, onProgress?: IDownloadOptions['onDownload']) {
        const writer = fs.createWriteStream(targetFile);
        let num = 0;
        for (const filePath of fileList) {
            onProgress?.({
                progress: num++ / fileList.length,
                total: fileList.length
            });
            const buf = await fs.promises.readFile(filePath);
            writer.write(buf);
        }
        writer.end();
        onProgress?.({
            progress: 1,
            total: fileList.length
        });
    }
}

export const m3u8 = new M3U8();
