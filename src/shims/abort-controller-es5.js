const AbortControllerImpl = typeof globalThis.AbortController !== 'undefined'
  ? globalThis.AbortController
  : class AbortController {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    };

const AbortSignalImpl = typeof globalThis.AbortSignal !== 'undefined'
  ? globalThis.AbortSignal
  : class AbortSignal {};

export default AbortControllerImpl;
export const AbortController = AbortControllerImpl;
export const AbortSignal = AbortSignalImpl;
