import fs from 'fs';
import path from 'path';

import { rimraf } from 'rimraf';
import { Parser as m3u8Parser } from 'm3u8-parser';
import { parallelLimit } from 'async';

const ParallelMaxLimit = 5;

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
    onDownload?: (progress: number) => void;
    onCombine?: (progress: number) => void;
}

class M3U8 {
    async download(options: IDownloadOptions) {
        const tempDir = path.join(path.dirname(options.target), `temp_m3u8_` + Date.now());

        try {
            await fs.promises.mkdir(tempDir);
            const segments = (await this.parseFromUrl(options.url)).map(n => n.url);

            const fileList = await this.downloadSegments(segments, tempDir, options.onDownload);
            await this.combineFiles(fileList, options.target, options.onCombine);
        } finally {
            await rimraf(tempDir);
        }
    }

    async parseFromUrl(url: string) {
        const txt = await fetch(url).then(n => n.text());

        const parser = new m3u8Parser();
        parser.push(txt);
        parser.end();

        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

        const manifest = parser.manifest;
        // 选择第一个数据源
        const firstPlayUri = manifest.playlists?.[0]?.['uri'];
        if (firstPlayUri && !manifest.segments.length) {
            return this.parseFromUrl(new URL(firstPlayUri, baseUrl).href);
        }

        return manifest.segments.map(segment => {
            return {
                url: new URL(segment.uri, baseUrl).href,
                duration: segment.duration
            };
        });
    }

    async downloadSegments(segments: string[], targetDir: string, onProgress?: (progress: number) => void) {
        let doneNum = 0;
        onProgress?.(0);
        const fileList = await parallelLimit<string, string[]>(
            segments.map((segUrl, segIndex) => {
                return async function () {
                    const aBuffer = await fetch(segUrl).then(n => n.arrayBuffer());
                    const targetName = path.join(targetDir, `segment_${segIndex}.ts`);

                    await fs.promises.writeFile(targetName, Buffer.from(aBuffer));

                    onProgress?.(++doneNum / segments.length);

                    return targetName;
                };
            }),
            ParallelMaxLimit
        );
        onProgress?.(1);
        return fileList;
    }

    async combineFiles(fileList: string[], targetFile: string, onProgress?: (progress: number) => void) {
        const writer = fs.createWriteStream(targetFile);
        let num = 0;
        for (const filePath of fileList) {
            onProgress?.(num++ / fileList.length);
            const buf = await fs.promises.readFile(filePath);
            writer.write(buf);
        }
        writer.end();
        onProgress?.(1);
    }
}

export const m3u8 = new M3U8();
