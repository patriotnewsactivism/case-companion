const NativeAbortController = (typeof window === 'undefined' ? {} : window).AbortController;
const NativeAbortSignal = (typeof window === 'undefined' ? {} : window).AbortSignal;

const AbortController = NativeAbortController;
const AbortSignal = NativeAbortSignal;

export default AbortController;
export { AbortController, AbortSignal };
