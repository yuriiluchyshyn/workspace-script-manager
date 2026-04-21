const API_BASE_URL = 'http://localhost:3001/api';

export const loadWorkspaces = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/workspaces`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to load workspaces:', response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error loading workspaces:', error);
    return [];
  }
};

export const saveWorkspaces = async (workspaces) => {
  try {
    const response = await fetch(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workspaces)
    });
    
    if (!response.ok) {
      console.error('Failed to save workspaces:', response.statusText);
    }
  } catch (error) {
    console.error('Error saving workspaces:', error);
  }
};

export const exportWorkspaces = async () => {
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
    } else {
      console.error('Failed to export workspaces:', response.statusText);
      return false;
    }
  } catch (error) {
    console.error('Error exporting workspaces:', error);
    return false;
  }
};

export const importWorkspaces = async (file) => {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    const response = await fetch(`${API_BASE_URL}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(importData)
    });
    
    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    }
  } catch (error) {
    console.error('Error importing workspaces:', error);
    throw error;
  }
};