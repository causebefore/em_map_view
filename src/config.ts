import * as vscode from 'vscode';

export interface MapViewConfig {
  warningThreshold: number;
  criticalThreshold: number;
  topModulesCount: number;
}

export function getConfig(): MapViewConfig {
  const config = vscode.workspace.getConfiguration('emMapView');
  return {
    warningThreshold: config.get('warningThreshold', 80),
    criticalThreshold: config.get('criticalThreshold', 95),
    topModulesCount: config.get('topModulesCount', 20),
  };
}
