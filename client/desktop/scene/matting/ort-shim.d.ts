declare module 'onnxruntime-web' {
  // Minimal surface used by ModNetMattingBackend (package exports confuse resolution).
  export class Tensor {
    constructor(type: string, data: Float32Array, dims: number[]);
    readonly data: Float32Array;
  }
  export class InferenceSession {
    static create(
      uri: string,
      options?: {
        executionProviders?: string[];
        graphOptimizationLevel?: string;
      },
    ): Promise<InferenceSession>;
    readonly inputNames: string[];
    readonly outputNames: string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, { data: Float32Array }>>;
  }
  export const env: {
    wasm: { wasmPaths: string; numThreads: number };
  };
}

declare module 'onnxruntime-web/webgpu' {
  export * from 'onnxruntime-web';
}
