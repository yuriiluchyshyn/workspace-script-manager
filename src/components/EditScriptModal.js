import React, { useState, useEffect } from 'react';

function EditScriptModal({ script, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    name: script.name,
    description: script.description || '',
    buttonLabel: script.buttonLabel || ''
  });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onUpdate(formData);
      onClose();
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Handle click outside modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit Script</h3>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label>Script Details (Read-only)</label>
            <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
              <div>Type: {script.type}</div>
              <div>File: {script.filePath}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditScriptModal;