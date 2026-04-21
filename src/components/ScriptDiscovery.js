import React, { useState, useEffect } from 'react';

function ScriptDiscovery({ onScriptSelect }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);

  const discoverScripts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/discover-scripts');
      if (response.ok) {
        const data = await response.json();
        setScripts(data.scripts);
      }
    } catch (error) {
      console.error('Error discovering scripts:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showDiscovery && scripts.length === 0) {
      discoverScripts();
    }
  }, [showDiscovery]);

  const handleScriptSelect = (script) => {
    onScriptSelect({
      name: script.name,
      filePath: script.absolutePath, // Use absolute path instead of relative
      type: script.type
    });
    setShowDiscovery(false);
  };

  return (
    <div style={{ marginTop: '5px' }}>
      <button 
        type="button" 
        className="btn btn-secondary" 
        onClick={() => setShowDiscovery(!showDiscovery)}
        style={{ fontSize: '12px', padding: '4px 8px' }}
      >
        Discover Scripts
      </button>
      
      {showDiscovery && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          background: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #ddd',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              Found Scripts:
            </div>
            <button 
              type="button" 
              onClick={discoverScripts}
              disabled={loading}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              className="btn btn-secondary"
            >
              {loading ? 'Searching...' : 'Refresh'}
            </button>
          </div>
          
          {scripts.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '20px' }}>
              {loading ? 'Searching for scripts...' : 'No scripts found in common directories'}
            </div>
          ) : (
            scripts.map((script, index) => (
              <div
                key={index}
                onClick={() => handleScriptSelect(script)}
                style={{
                  padding: '8px',
                  margin: '4px 0',
                  background: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e9ecef'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <div style={{ fontWeight: 'bold' }}>{script.fileName}</div>
                <div style={{ color: '#666' }}>Path: {script.relativePath}</div>
                <div style={{ color: '#666' }}>Type: {script.type.toUpperCase()}</div>
              </div>
            ))
          )}
          
          {scripts.length > 0 && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
              Click on a script to auto-fill the form fields
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScriptDiscovery;