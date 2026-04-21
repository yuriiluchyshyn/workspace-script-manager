import React, { useState, useEffect } from 'react';

function CreatePackageModal({ onClose, onCreate, parentPackage = '' }) {
  const [packageName, setPackageName] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (packageName.trim()) {
      const fullPath = parentPackage 
        ? `${parentPackage}/${packageName.trim()}`
        : packageName.trim();
      onCreate(fullPath);
      onClose();
    }
  };

  const validatePackageName = (name) => {
    // Allow letters, numbers, hyphens, underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  };

  const isValid = packageName.trim() && validatePackageName(packageName.trim());

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New Package</h3>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        
        {parentPackage && (
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Creating package inside: <strong>{parentPackage}</strong>
          </p>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="packageName">Package Name *</label>
            <input
              type="text"
              id="packageName"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              required
              placeholder="e.g., frontend, api, components"
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Use letters, numbers, hyphens, and underscores only. No spaces or special characters.
            </small>
            {packageName && !validatePackageName(packageName.trim()) && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                Invalid package name. Use only letters, numbers, hyphens, and underscores.
              </div>
            )}
          </div>

          <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
            <strong>Full package path:</strong><br/>
            <code>
              {parentPackage ? `${parentPackage}/` : ''}{packageName || 'package-name'}
            </code>
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!isValid}
            >
              Create Package
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePackageModal;