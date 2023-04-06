import { TextLineStream } from "https://deno.land/std@0.182.0/streams/mod.ts";
const utf8File = await Deno.open("./data/00_zenkoku_all_20230331_utf.csv");
const sjisFile = await Deno.open("./data/00_zenkoku_all_20230331_sjis.csv");

class StreamMerger<T, U> extends ReadableStream<[T, U]> {
  constructor(readonly a: ReadableStream<T>, readonly b: ReadableStream<U>) {
    let readerA: ReadableStreamDefaultReader<T>;
    let readerB: ReadableStreamDefaultReader<U>;
    super({
      start() {
        readerA = a.getReader();
        readerB = b.getReader();
      },
      pull: async (controller) => {
        const [a, b] = await Promise.all([
          readerA.read(),
          readerB.read()
        ]);
        if (a.done || b.done) {
          controller.close();
        } else {
          controller.enqueue([a.value, b.value]);
        }
      },
      cancel: (reason) => {
        this.a.cancel(reason);
        this.b.cancel(reason);
      },
    });
  }
}
const merger = new StreamMerger(
  utf8File.readable
    .pipeThrough(new TextDecoderStream("utf-8"))
    .pipeThrough(new TextLineStream({ allowCR: true })),
  sjisFile.readable
    .pipeThrough(new TextDecoderStream("shift-jis"))
    .pipeThrough(new TextLineStream({ allowCR: true }))
);

const map: Record<string, string> = {};
for await (const [utf8, sjis] of merger) {
  const result = /[\uD840-\uD87F][\uDC00-\uDFFF]/g.exec(utf8);
  if (result) {
    for (const char of result) {
      const index = utf8.indexOf(char);
      map[`${utf8[index]}${utf8[index + 1]}`] = sjis[index];
    }
    if (utf8.includes("𩺊")) {
      console.log(utf8);
    }
  }
}

console.log(map);
