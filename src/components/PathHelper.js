import React, { useState } from 'react';

function PathHelper({ onPathSelect }) {
  const [showHelper, setShowHelper] = useState(false);

  const commonPaths = [
    { label: 'Volumes (macOS external drives)', path: '/Volumes/' },
    { label: 'User home directory', path: '/Users/' },
    { label: 'Applications', path: '/Applications/' },
    { label: 'Current project examples', path: './examples/' },
    { label: 'Current project scripts', path: './scripts/' }
  ];

  const handlePathClick = (basePath) => {
    onPathSelect(basePath);
    setShowHelper(false);
  };

  return (
    <div style={{ marginTop: '5px' }}>
      <button 
        type="button" 
        className="btn btn-secondary" 
        onClick={() => setShowHelper(!showHelper)}
        style={{ fontSize: '12px', padding: '4px 8px' }}
      >
        Path Helper
      </button>
      
      {showHelper && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          background: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            Common path prefixes (click to use):
          </div>
          {commonPaths.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handlePathClick(item.path)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '4px 8px',
                margin: '2px 0',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <strong>{item.path}</strong> - {item.label}
            </button>
          ))}
          <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', padding: '8px', background: '#fff3cd', borderRadius: '4px' }}>
            <strong>⚠️ Use FULL absolute paths:</strong><br/>
            ✅ <code>/Volumes/Work/projects/my-app/scripts/deploy.cjs</code><br/>
            ✅ <code>/Users/username/Documents/scripts/start.py</code><br/>
            ❌ <code>deploy.cjs</code> (just filename)<br/>
            ❌ <code>./scripts/deploy.cjs</code> (relative path)
          </div>
        </div>
      )}
    </div>
  );
}

export default PathHelper;