import type { FiberInputs, KesProperties } from "../types";
import { predictKes } from "./surrogate";

export type InferenceBackend = "surrogate" | "onnx";

export interface OnnxEngineStatus {
  backend: InferenceBackend;
  ready: boolean;
  modelUrl: string | null;
  message: string;
}

const INPUT_NAMES = ["denier", "crystallinity", "length_mm", "crimp_cpi", "shape_id"] as const;

/**
 * Browser ONNX Runtime Web adapter.
 * Drop a trained .onnx file into /public/models/fiber_kes.onnx and call loadOnnxModel().
 * Until a model is present, inference falls back to the numerical surrogate.
 */
export class OnnxKesEngine {
  private session: unknown = null;
  private modelUrl: string | null = null;

  getStatus(): OnnxEngineStatus {
    if (this.session) {
      return {
        backend: "onnx",
        ready: true,
        modelUrl: this.modelUrl,
        message: "ONNX Runtime Web 세션 활성",
      };
    }
    return {
      backend: "surrogate",
      ready: true,
      modelUrl: null,
      message: "수치 대리 모델 (ONNX 대기)",
    };
  }

  async loadOnnxModel(url = "/models/fiber_kes.onnx"): Promise<boolean> {
    try {
      const ort = await import("onnxruntime-web");
      this.session = await ort.InferenceSession.create(url, {
        executionProviders: ["wasm"],
      });
      this.modelUrl = url;
      return true;
    } catch {
      this.session = null;
      this.modelUrl = null;
      return false;
    }
  }

  async infer(inputs: FiberInputs): Promise<{ kes: KesProperties; backend: InferenceBackend }> {
    if (!this.session) {
      return { kes: predictKes(inputs), backend: "surrogate" };
    }

    try {
      const ort = await import("onnxruntime-web");
      const shapeId = inputs.shape === "circular" ? 0 : inputs.shape === "trilobal" ? 1 : 2;
      const tensor = new ort.Tensor(
        "float32",
        new Float32Array([
          inputs.denier,
          inputs.crystallinity,
          inputs.lengthMm,
          inputs.crimpCpi,
          shapeId,
        ]),
        [1, 5],
      );

      const session = this.session as {
        run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
        inputNames: string[];
        outputNames: string[];
      };

      const inputName = session.inputNames?.[0] ?? INPUT_NAMES[0];
      const results = await session.run({ [inputName]: tensor });
      const outName = session.outputNames?.[0] ?? Object.keys(results)[0];
      const data = results[outName].data;

      return {
        backend: "onnx",
        kes: {
          B: data[0],
          G: data[1],
          EMT: data[2],
          W: data[3],
          H0: data[4],
          DC: data[5],
        },
      };
    } catch {
      return { kes: predictKes(inputs), backend: "surrogate" };
    }
  }
}

export const onnxEngine = new OnnxKesEngine();
