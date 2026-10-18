import { 
  processNativeConcatStream, 
  processNativeTrimStream, 
  processNativeRemuxStream 
} from './WEngine';
import { 
  processWebCodecsEncodeStream, 
  processWebCodecsConcatStream 
} from './WebCodecsEngine';

(self as any).onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;
  
  try {
    const { files, settings, startTime, endTime } = payload;
    
    const mockWritable = {
      async write(chunkOrData: any) {
        let position = undefined;
        let data = chunkOrData;
        if (chunkOrData && typeof chunkOrData === 'object' && 'data' in chunkOrData) {
          position = chunkOrData.position;
          data = chunkOrData.data;
        }
        const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
        (self as any).postMessage({
          id,
          type: 'chunk',
          chunk: {
            position,
            data: uint8
          }
        });
      },
      async seek(_pos: number) {},
      async truncate() {},
      async close() {}
    } as any;

    let result;
    const onProgress = (prog: any) => {
      (self as any).postMessage({ id, type: 'progress', progress: prog });
    };

    if (action === 'concat') {
      if (settings?.encodeMode) {
        result = await processWebCodecsConcatStream(files, settings, mockWritable, onProgress);
      } else {
        result = await processNativeConcatStream(files, mockWritable, onProgress);
      }
    } else if (action === 'trim') {
      const file = files[0];
      if (settings?.encodeMode) {
        result = await processWebCodecsEncodeStream(file, settings, mockWritable, onProgress);
      } else {
        result = await processNativeTrimStream(file, startTime, endTime, mockWritable, onProgress);
      }
    } else if (action === 'remux') {
      const file = files[0];
      result = await processNativeRemuxStream(file, mockWritable, onProgress);
    } else if (action === 'encode') {
      const file = files[0];
      result = await processWebCodecsEncodeStream(file, settings, mockWritable, onProgress);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    (self as any).postMessage({ id, success: true, result });
  } catch (err: any) {
    (self as any).postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
