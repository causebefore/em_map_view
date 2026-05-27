interface VSCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

export function postMessage(msg: any): void {
  vscode.postMessage(msg);
}

export function onMessage(handler: (msg: any) => void): () => void {
  const listener = (e: MessageEvent) => handler(e.data);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setState<T>(state: T): void {
  vscode.setState(state);
}
