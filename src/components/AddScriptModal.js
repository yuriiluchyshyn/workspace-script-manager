import React, { useState, useEffect } from 'react';

// For path operations
const path = window.require ? window.require('path') : { extname: (p) => p.substring(p.lastIndexOf('.')) };

function AddScriptModal({ onClose, onAdd, currentPackage = null }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    filePath: '',
    buttonLabel: '',
    packagePath: currentPackage || '',
    detectedParams: []
  });
  const [pathValidation, setPathValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [analyzingScript, setAnalyzingScript] = useState(false);
  const [copyToProject, setCopyToProject] = useState(false);

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

  const validatePath = async (filePath) => {
    if (!filePath.trim()) {
      setPathValidation(null);
      setFormData(prev => ({ ...prev, detectedParams: [] }));
      return;
    }
    
    setValidating(true);
    try {
      const response = await fetch('http://localhost:3001/api/validate-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath })
      });
      
      if (response.ok) {
        const result = await response.json();
        setPathValidation(result);
        
        // Auto-update type if validation is successful
        if (result.valid && result.type) {
          // Extract filename without extension for script name and button label
          const fileName = filePath.split('/').pop().split('\\').pop(); // Handle both Unix and Windows paths
          const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
          
          setFormData(prev => ({ 
            ...prev, 
            type: result.type,
            // Only auto-populate if fields are empty
            name: prev.name || nameWithoutExtension,
            buttonLabel: prev.buttonLabel || nameWithoutExtension
          }));
          
          // Analyze script for parameters
          analyzeScript(filePath);
        }
      }
    } catch (error) {
      console.error('Path validation error:', error);
      // Backend not available — do local validation (Vercel mode)
      const fileName = filePath.split('/').pop().split('\\').pop();
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      const validExtensions = ['.sh', '.py', '.js', '.cjs'];
      
      if (validExtensions.includes(ext)) {
        let scriptType = 'sh';
        if (ext === '.py') scriptType = 'py';
        else if (ext === '.cjs') scriptType = 'cjs';
        else if (ext === '.js') scriptType = 'js';
        
        const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
        
        setPathValidation({ valid: true, type: scriptType, resolvedPath: filePath, localOnly: true });
        setFormData(prev => ({ 
          ...prev, 
          type: scriptType,
          name: prev.name || nameWithoutExtension,
          buttonLabel: prev.buttonLabel || nameWithoutExtension
        }));
      } else {
        setPathValidation({ valid: false, error: 'File must be .sh, .py, .js, or .cjs' });
      }
    }
    setValidating(false);
  };

  const analyzeScript = async (filePath) => {
    setAnalyzingScript(true);
    try {
      const response = await fetch('http://localhost:3001/api/analyze-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath })
      });
      
      if (response.ok) {
        const result = await response.json();
        setFormData(prev => ({ 
          ...prev, 
          type: result.scriptType,
          detectedParams: result.parameters || [],
          // Auto-populate description from script @description comment
          description: prev.description || result.description || ''
        }));
      }
    } catch (error) {
      console.error('Script analysis error:', error);
    }
    setAnalyzingScript(false);
  };

  const handlePathChange = (e) => {
    const newPath = e.target.value;
    setFormData({
      ...formData,
      filePath: newPath
    });
    
    // Debounce validation
    clearTimeout(window.pathValidationTimeout);
    window.pathValidationTimeout = setTimeout(() => {
      validatePath(newPath);
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.name.trim() && formData.filePath.trim()) {
      if (pathValidation && !pathValidation.valid) {
        alert('Please fix the file path before adding the script.');
        return;
      }
      
      let finalFilePath = formData.filePath;
      
      // Copy script to project if requested
      if (copyToProject && pathValidation && pathValidation.valid) {
        try {
          const fileName = formData.name + path.extname(formData.filePath);
          const response = await fetch('http://localhost:3001/api/copy-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sourcePath: formData.filePath, 
              scriptName: fileName 
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            finalFilePath = result.targetPath;
            alert(`Script copied to project: ${result.relativePath}`);
          } else {
            const error = await response.json();
            alert(`Failed to copy script: ${error.message}`);
            return;
          }
        } catch (error) {
          alert(`Error copying script: ${error.message}`);
          return;
        }
      }
      
      onAdd({
        ...formData,
        filePath: finalFilePath
      });
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add New Script</h3>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        
        {currentPackage && (
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Adding to package: <strong>{currentPackage}</strong>
          </p>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="filePath">Script File Path *</label>
            <input
              type="text"
              id="filePath"
              name="filePath"
              value={formData.filePath}
              onChange={handlePathChange}
              required
              placeholder="Enter full absolute path to script file (e.g., /Volumes/Work/projects/my-script.py)"
              className="file-path-input"
            />
            
            <div className="copy-option">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={copyToProject}
                  onChange={(e) => setCopyToProject(e.target.checked)}
                />
                Copy script to project scripts folder
              </label>
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                If checked, the script will be copied to ./scripts/ folder within the project
              </small>
            </div>
            
            {/* Path Validation Display */}
            {validating && (
              <div style={{ fontSize: '12px', color: '#007bff', marginTop: '5px' }}>
                Validating path...
              </div>
            )}
            
            {pathValidation && (
              <div style={{ 
                fontSize: '12px', 
                marginTop: '5px',
                padding: '8px',
                borderRadius: '4px',
                background: pathValidation.valid ? '#d4edda' : '#f8d7da',
                color: pathValidation.valid ? '#155724' : '#721c24',
                border: `1px solid ${pathValidation.valid ? '#c3e6cb' : '#f5c6cb'}`
              }}>
                {pathValidation.valid ? (
                  <div>
                    ✅ <strong>{pathValidation.localOnly ? 'Script path accepted' : 'Valid script found!'}</strong><br/>
                    Type: {pathValidation.type?.toUpperCase()} (auto-detected)<br/>
                    Path: {pathValidation.resolvedPath}
                    {pathValidation.localOnly && (
                      <><br/><em>Note: Path will be validated when local agent is running</em></>
                    )}
                  </div>
                ) : (
                  <div>
                    ❌ <strong>Path Error:</strong> {pathValidation.error}<br/>
                    {pathValidation.resolvedPath && (
                      <>Resolved to: {pathValidation.resolvedPath}<br/></>
                    )}
                    {pathValidation.cwd && (
                      <>Server directory: {pathValidation.cwd}</>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Script Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter script name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter script description"
            />
          </div>

          <div className="form-group">
            <label htmlFor="packagePath">Package Path</label>
            <input
              type="text"
              id="packagePath"
              name="packagePath"
              value={formData.packagePath}
              onChange={handleChange}
              placeholder="e.g., frontend/components or backend/api/auth"
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Optional: Organize scripts in nested packages using forward slashes
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="buttonLabel">Custom Button Label</label>
            <input
              type="text"
              id="buttonLabel"
              name="buttonLabel"
              value={formData.buttonLabel}
              onChange={handleChange}
              placeholder="e.g., 'Start Server', 'Deploy', 'Test'"
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={pathValidation && !pathValidation.valid}
            >
              Add Script
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddScriptModal;