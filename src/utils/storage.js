const API_BASE_URL = 'http://localhost:3001/api';

// Storage keys for localStorage fallback
const STORAGE_KEYS = {
  config: 'runner-yl-config',
  workspaces: 'runner-yl-workspaces',
  settings: 'runner-yl-settings'
};

// Initialize localStorage config on first visit
const initLocalStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.config)) {
    const config = {
      dataDir: 'localStorage',
      workspacesKey: STORAGE_KEYS.workspaces,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
    console.log('[storage] Created config in localStorage');
  }

  if (!localStorage.getItem(STORAGE_KEYS.workspaces)) {
    localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify([]));
    console.log('[storage] Created empty workspaces in localStorage');
  }
};

// Check if the backend server is available
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
  if (!backendAvailable) {
    console.log('[storage] Backend not available, using localStorage');
    initLocalStorage();
  }
  return backendAvailable;
};

export const loadWorkspaces = async () => {
  const useBackend = await checkBackend();

  if (useBackend) {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Backend error, falling back to localStorage:', error);
    }
  }

  // localStorage fallback
  initLocalStorage();
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.workspaces)) || [];
  } catch {
    return [];
  }
};

export const saveWorkspaces = async (workspaces) => {
  const useBackend = await checkBackend();

  if (useBackend) {
    try {
      const response = await fetch(`${API_BASE_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspaces)
      });
      if (response.ok) return;
    } catch (error) {
      console.error('Backend error, falling back to localStorage:', error);
    }
  }

  // localStorage fallback
  localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(workspaces));
};

export const exportWorkspaces = async () => {
  const useBackend = await checkBackend();

  let workspaces;
  if (useBackend) {
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
    } catch (error) {
      console.error('Backend export error, using localStorage:', error);
    }
  }

  // localStorage fallback export
  try {
    workspaces = JSON.parse(localStorage.getItem(STORAGE_KEYS.workspaces)) || [];
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      workspaces
    };
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
  } catch (error) {
    console.error('Error exporting workspaces:', error);
    return false;
  }
};

export const importWorkspaces = async (file) => {
  const text = await file.text();
  const importData = JSON.parse(text);

  if (!importData.workspaces || !Array.isArray(importData.workspaces)) {
    throw new Error('Invalid import data format');
  }

  const useBackend = await checkBackend();

  if (useBackend) {
    try {
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });
      if (response.ok) {
        return await response.json();
      }
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    } catch (error) {
      if (error.message !== 'Import failed') {
        console.error('Backend import error, using localStorage:', error);
      } else {
        throw error;
      }
    }
  }

  // localStorage fallback import
  localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(importData.workspaces));
  return {
    success: true,
    message: `Imported ${importData.workspaces.length} workspaces successfully`,
    count: importData.workspaces.length
  };
};
