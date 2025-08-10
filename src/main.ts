import path from "path";
import got from "got";
import { promisify } from "node:util";
import stream from "node:stream";
import fs from "node:fs";
import { bootstrap } from "global-agent";
import axios from "axios";
import { parallelLimit } from "async";
import { combilefiles } from "./combilefiles";

bootstrap();

// global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:10809';

const pipeline = promisify(stream.pipeline);

async function downloadFile(source: string, target: string) {
  await new Promise((resolve) => {
    pipeline(
      got.stream({
        url: source,
        headers: {
          referer: "",
          origin: "",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
        },
      }),
      fs.createWriteStream(target).on("finish", resolve)
    );
  });
}

async function beginDownloadFiles() {
  const urls = Array.from({ length: 147 }).map(
    (_, index) => `xxx/seg-${index + 1}-xxx`
  );

  await new Promise((resolve) => {
    parallelLimit(
      urls.map((url) => {
        return async function (callback) {
          // new URL(url).pathname
          try {2
            await downloadFile(
              url,
              path.join(
                __dirname,
                `../videos/${path.basename(new URL(url).pathname)}`
              )
            );

            console.log("done..." + url);
            callback(null);
          } catch (err: any) {
            callback(err);
          }
        };
      }),
      5,
      (err, result) => {
        if (err) {
          console.log(err);
        }
        console.log("all done");
        resolve(true);
      }
    );
  });

  // for (const url of urls) {
  //   // console.log("start..." + url);
  //   await downloadFile(
  //     url,
  //     path.join(__dirname, `../videos/${path.basename(url)}`)
  //   );

  //   console.log("done..." + url);
  // }
}

(async () => {
  await beginDownloadFiles();
  await combilefiles();
})();
