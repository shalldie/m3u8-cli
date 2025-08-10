import fs from "fs";
import path from "path";

export async function combilefiles() {
  const files = await fs.promises.readdir(path.join(__dirname, "../videos"));
  files.sort((f1, f2) => {
    return +f1.split("-")[1] - +f2.split("-")[1];
  });

  const targetFile = path.join(__dirname, "../video.ts");
  //   await fs.promises.writeFile(targetFile, "");

  const buffers = [] as Buffer[];
  for (let file of files) {
    file = path.join(__dirname, "../videos", file);
    console.log(file);
    const c = fs.readFileSync(file);
    if (c.length === 376) {
      console.log("jump..." + file);
      continue;
    }
    buffers.push(c);
    // content += c.toString() + "\n";

    // const buffer = await fs.promises.readFile(file, "utf-8");
    // await fs.promises.writeFile(targetFile, buffer, {
    //   encoding: "utf-8",
    //   flag: "a",
    //   mode: 438,
    // });
  }

  await fs.promises.writeFile(targetFile, Buffer.concat(buffers));
  console.log("combile files done.");
  // fs.promises.a
}

// combilefiles();
