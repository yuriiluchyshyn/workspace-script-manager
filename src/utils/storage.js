const API_BASE_URL = 'http://localhost:3001/api';

const STORAGE_KEYS = {
  config: 'runner-yl-config',
  workspaces: 'runner-yl-workspaces',
  settings: 'runner-yl-settings'
};

// Check if storage has been set up (user saw the welcome screen)
export const isStorageSetUp = () => localStorage.getItem(STORAGE_KEYS.config) !== null;

// Initialize browser storage
export const initStorage = () => {
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({
    createdAt: new Date().toISOString(),
    storage: 'localStorage'
  }));
  if (!localStorage.getItem(STORAGE_KEYS.workspaces)) {
    localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify([]));
  }
};

// Check if backend server is available
let backendAvailable = null;
const checkBackend = async () => {
  if (backendAvailable !== null) return backendAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${API_BASE_URL}/workspaces`, { signal: controller.signal });
    clearTimeout(timeout);
    backendAvailable = response.ok;
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
};

export const loadWorkspaces = async () => {
  if (await checkBackend()) {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`);
      if (response.ok) return await response.json();
    } catch {}
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.workspaces)) || [];
  } catch {
    return [];
  }
};

export const saveWorkspaces = async (workspaces) => {
  if (await checkBackend()) {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspaces)
      });
      if (response.ok) return;
    } catch {}
  }
  localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(workspaces));
};

export const exportWorkspaces = async () => {
  if (await checkBackend()) {
    try {
      const response = await fetch(`${API_BASE_URL}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workspace-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return true;
      }
    } catch {}
  }

  const workspaces = await loadWorkspaces();
  const exportData = { version: '1.0.0', exportDate: new Date().toISOString(), workspaces };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workspace-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  return true;
};

export const importWorkspaces = async (file) => {
  const text = await file.text();
  const importData = JSON.parse(text);
  if (!importData.workspaces || !Array.isArray(importData.workspaces)) {
    throw new Error('Invalid import data format');
  }

  if (await checkBackend()) {
    try {
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });
      if (response.ok) return await response.json();
    } catch {}
  }

  await saveWorkspaces(importData.workspaces);
  return { success: true, message: `Imported ${importData.workspaces.length} workspaces`, count: importData.workspaces.length };
};
