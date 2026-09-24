import { removeBackground } from "@imgly/background-removal";

self.onmessage = async (event: MessageEvent<{ id: number; imageBlob: Blob }>) => {
  const { id, imageBlob } = event.data;
  try {
    const resultBlob = await removeBackground(imageBlob, {
      model: "isnet_fp16",
      proxyToWorker: false,
      debug: false,
    });
    self.postMessage({ id, success: true, resultBlob });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
