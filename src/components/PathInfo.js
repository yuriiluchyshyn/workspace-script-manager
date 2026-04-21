import React, { useState, useEffect } from 'react';

function PathInfo() {
  const [cwdInfo, setCwdInfo] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const fetchCwdInfo = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/cwd-info');
        if (response.ok) {
          const data = await response.json();
          setCwdInfo(data);
        }
      } catch (error) {
        console.error('Error fetching CWD info:', error);
      }
    };

    if (showInfo && !cwdInfo) {
      fetchCwdInfo();
    }
  }, [showInfo, cwdInfo]);

  return (
    <div style={{ marginTop: '5px' }}>
      <button 
        type="button" 
        className="btn btn-secondary" 
        onClick={() => setShowInfo(!showInfo)}
        style={{ fontSize: '12px', padding: '4px 8px' }}
      >
        Path Info
      </button>
      
      {showInfo && cwdInfo && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          background: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            Server Information:
          </div>
          
          <div style={{ fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}>
            <strong>Current Working Directory:</strong><br/>
            <code>{cwdInfo.cwd}</code>
          </div>
          
          <div style={{ fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}>
            <strong>Home Directory:</strong><br/>
            <code>{cwdInfo.homeDir}</code>
          </div>
          
          <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            Path Examples:
          </div>
          
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <strong>Absolute path:</strong><br/>
            <code>{cwdInfo.example.absolute}</code>
          </div>
          
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <strong>Relative to server directory:</strong><br/>
            <code>{cwdInfo.example.relative}</code>
          </div>
          
          <div style={{ fontSize: '11px', marginBottom: '8px' }}>
            <strong>Home directory relative:</strong><br/>
            <code>{cwdInfo.example.home}</code>
          </div>
          
          <div style={{ 
            fontSize: '11px', 
            color: '#dc3545', 
            background: '#f8d7da', 
            padding: '8px', 
            borderRadius: '3px',
            border: '1px solid #f5c6cb'
          }}>
            <strong>⚠️ Important:</strong> If your script is in a different directory than the server, 
            you must provide the full absolute path to the script file.
          </div>
        </div>
      )}
    </div>
  );
}

export default PathInfo;