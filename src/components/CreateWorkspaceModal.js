import React, { useState, useEffect } from 'react';

function CreateWorkspaceModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
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

  // Handle click outside modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onCreate(formData);
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
          <h3>Create New Workspace</h3>
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
            <label htmlFor="name">Workspace Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter workspace name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter workspace description"
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateWorkspaceModal;