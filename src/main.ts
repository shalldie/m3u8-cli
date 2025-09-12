// https://hlsjs.video-dev.org/demo/
// https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8

import { ProxyAgent, setGlobalDispatcher } from 'undici';

import { M3U8 } from './m3u8';

(async () => {
    if (process.env.M3U8_PROXY) {
        const agent = new ProxyAgent(process.env.M3U8_PROXY);
        setGlobalDispatcher(agent);
    }

    await new M3U8({
        url: process.env.M3U8_URL!,
        target: 'out/some.ts',
        onDownload(progress) {
            console.log('download', (progress.progress * 100).toFixed(2) + '%');
        },
        onCombine(progress) {
            console.log('combine', progress);
        }
    }).download();
})();
