/**
 * Lets an overlay claim the Android hardware back press before it becomes a navigation.
 *
 * Capacitor fires every `backButton` listener with no notion of priority, so a modal that
 * registered its own would still let {@link BackButtonHandler} navigate the page away
 * underneath it. Instead, overlays register here and the single global handler asks this
 * list first.
 *
 * Interceptors run most-recently-registered first, which is the order they are stacked on
 * screen, and the first one to return `true` consumes the press.
 */
const interceptors = new Set();

/** Registers an interceptor and returns its removal function. */
export const addBackInterceptor = (handler) => {
  interceptors.add(handler);
  return () => interceptors.delete(handler);
};

/** Runs the stack, innermost first. Returns true when a press was consumed. */
export const runBackInterceptors = () => {
  const stack = [...interceptors].reverse();
  return stack.some((handler) => handler() === true);
};
