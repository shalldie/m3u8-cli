// https://hlsjs.video-dev.org/demo/
// https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8

// import { bootstrap } from 'global-agent';

import { m3u8 } from './m3u8';

// bootstrap();

// global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:10809';

(async () => {
    await m3u8.download({
        url: 'https://test-streams.mux.dev/x36xhzz/url_2/193039199_mp4_h264_aac_ld_7.m3u8',
        target: 'output/some.ts',
        onDownload(progress) {
            console.log('download', progress);
        },
        onCombine(progress) {
            console.log('combine', progress);
        }
    });
})();
