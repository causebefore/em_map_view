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

export function onMessage(handler: (msg: any) => void): void {
  window.addEventListener('message', (e) => handler(e.data));
}

export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setState<T>(state: T): void {
  vscode.setState(state);
}
