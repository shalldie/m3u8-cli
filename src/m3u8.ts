import fs from 'fs';
import path from 'path';
import crypto, { createDecipheriv } from 'crypto';

import { fetch } from 'undici';
import { rimraf } from 'rimraf';
import { Parser as m3u8Parser, Segment as ISegment } from 'm3u8-parser';
import { parallelLimit } from 'async';

const ParallelMaxLimit = 8; // 并行下载数量
const MaxRetriesLimit = 5; // 重试次数

// const obj = {
//     headers: {
//         referer: '',
//         origin: '',
//         'user-agent':
//             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
//     }
// };

async function request(url: string): Promise<Buffer<ArrayBuffer>> {
    // 需要重新下载
    let retries = MaxRetriesLimit; // 重试次数
    const buf = await (async function invokeRequest() {
        try {
            const buf = await fetch(url)
                .then(n => n.arrayBuffer())
                .then(n => Buffer.from(n));

            return buf;
        } catch (ex) {
            retries--;
            if (retries > 0) {
                return invokeRequest();
            }

            return Promise.reject(ex);
        }
    })();
    return buf;
}

interface IDownloadOptions {
    url: string;
    target: string;
    onDownload?: (args: { progress: number; total: number }) => void;
    onCombine?: (args: { progress: number; total: number }) => void;
}

export class M3U8 {
    private key?: Buffer<ArrayBuffer>;

    private get baseUrl() {
        return this.options.url.substring(0, this.options.url.lastIndexOf('/') + 1);
    }

    constructor(private options: IDownloadOptions) {}

    async download() {
        const options = this.options;

        // 获取 segments
        const muInfo = await this.parseFromUrl(options.url);

        // 准备目录
        const tempDir = path.join(path.dirname(options.target), `temp_m3u8_` + muInfo.md5);
        await fs.promises.mkdir(tempDir, { recursive: true });

        // 保存 key
        if (muInfo.segments[0]?.key) {
            this.key = await request(new URL(muInfo.segments[0].key.uri, this.baseUrl).href);
        }

        // const segments = muInfo.segments.map(n => n.url);

        // 下载并合并 segments
        const fileList = await this.downloadSegments(muInfo.segments, tempDir, options.onDownload);
        await this.combineFiles(fileList, options.target, options.onCombine);

        await rimraf(tempDir);
    }

    private async parseFromUrl(url: string): Promise<{ md5: string; txt: string; segments: ISegment[] }> {
        // const muAb = await request(url).then(n => n.arrayBuffer());
        const muBytes = await request(url);
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

        const segments = manifest.segments.map<ISegment>(seg => {
            return {
                ...seg,
                uri: new URL(seg.uri, baseUrl).href
            };
        });

        return {
            md5,
            txt: muTxt,
            segments
        };
    }

    private async decryptSeg(seg: ISegment, encryptedData: Buffer<ArrayBufferLike>) {
        // 创建解密器
        const decipher = createDecipheriv('aes-128-cbc', this.key!, seg.key!.iv!);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted;
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
        if (fs.existsSync(targetFile)) {
            await fs.promises.rm(targetFile);
        }
        const aBuf = await request(segUrl);
        await fs.promises.writeFile(targetFile, aBuf);
    }

    private async downloadSegments(
        segments: ISegment[],
        targetDir: string,
        onProgress?: IDownloadOptions['onDownload']
    ) {
        let doneNum = 0;
        onProgress?.({
            progress: 0,
            total: segments.length
        });
        const fileList = await parallelLimit<string, string[]>(
            segments.map((seg, segIndex) => {
                return async () => {
                    const targetFile = path.join(targetDir, `segment_${segIndex}.ts`);
                    await this.downloadSingleSeg(seg.uri, targetFile);

                    onProgress?.({
                        progress: ++doneNum / segments.length,
                        total: segments.length
                    });

                    if (this.key) {
                        const encryptedData = await fs.promises.readFile(targetFile);
                        const decryptedData = await this.decryptSeg(seg, encryptedData);
                        const decryptedFile = path.join(targetDir, `decode_segment_${segIndex}.ts`);
                        await fs.promises.writeFile(decryptedFile, decryptedData);
                        return decryptedFile;
                    }

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

    private async combineFiles(fileList: string[], targetFile: string, onProgress?: IDownloadOptions['onDownload']) {
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
