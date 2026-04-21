import React, { useState, useEffect } from 'react';

function SettingsModal({ onClose, onSave, onKillAll }) {
  const [settings, setSettings] = useState({
    nodePath: 'node',
    pythonPath: 'python3'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc, true);
    return () => {
      document.removeEventListener('keydown', handleEsc, true);
    };
  }, [onClose]);

  // Handle click outside modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        onSave(settings);
        onClose();
      } else {
        alert('Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetToDefaults = () => {
    setSettings({
      nodePath: 'node',
      pythonPath: 'python3'
    });
  };

  if (loading) {
    return (
      <div className="modal" onClick={handleBackdropClick}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Loading Settings...</h3>
            <button 
              className="modal-close-btn"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Settings</h3>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Configure paths for script execution. Leave empty to use system defaults.
        </p>

        <div className="form-group">
          <label htmlFor="nodePath">Node.js Path</label>
          <input
            id="nodePath"
            type="text"
            value={settings.nodePath}
            onChange={(e) => handleInputChange('nodePath', e.target.value)}
            placeholder="node (default) or /path/to/node"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Used for running .js and .cjs scripts. Examples: 'node', '/usr/local/bin/node', 'C:\Program Files\nodejs\node.exe'
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="pythonPath">Python Path</label>
          <input
            id="pythonPath"
            type="text"
            value={settings.pythonPath}
            onChange={(e) => handleInputChange('pythonPath', e.target.value)}
            placeholder="python3 (default) or /path/to/python"
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Used for running .py scripts. Examples: 'python3', 'python', '/usr/bin/python3'
          </small>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Supported Script Types:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
            <li><strong>.sh</strong> - Shell scripts (uses bash)</li>
            <li><strong>.py</strong> - Python scripts (uses configured Python path)</li>
            <li><strong>.js</strong> - JavaScript files (uses configured Node.js path)</li>
            <li><strong>.cjs</strong> - CommonJS modules (uses configured Node.js path)</li>
          </ul>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#856404' }}>Danger Zone</h4>
          <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#856404' }}>
            This action will stop all running scripts across all workspaces. Use with caution.
          </p>
          <button 
            className="btn btn-danger"
            onClick={() => {
              onKillAll();
              onClose();
            }}
            title="Kill all running scripts in all workspaces"
          >
            🔥 Kill All Scripts
          </button>
        </div>

        <div className="modal-actions">
          <button 
            className="btn btn-secondary" 
            onClick={resetToDefaults}
            style={{ marginRight: '10px' }}
          >
            Reset to Defaults
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ marginRight: '10px' }}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;