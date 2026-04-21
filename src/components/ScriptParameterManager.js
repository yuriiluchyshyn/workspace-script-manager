import React, { useState, useEffect } from 'react';

function ScriptParameterManager({ script, onUpdateScript, isInline = false }) {
  const [parameterValues, setParameterValues] = useState({});
  const [parameterStates, setParameterStates] = useState({});
  const [showParameters, setShowParameters] = useState(false);

  // Helper function to get a descriptive parameter name
  const getParameterDisplayName = (param, index) => {
    // If there's a description, use it
    if (param.description && param.description.trim()) {
      return param.description.trim();
    }
    
    // If there's a flag, use it
    if (param.flag) {
      return param.flag;
    }
    
    // If there's a name, use it
    if (param.name) {
      return param.name;
    }
    
    // Generate a descriptive name based on position
    const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    const ordinal = ordinals[index] || `${index + 1}th`;
    return `${ordinal} Argument`;
  };

  // Initialize parameter values and states from script
  useEffect(() => {
    if (script.detectedParams && script.detectedParams.length > 0) {
      const values = {};
      const states = {};
      
      script.detectedParams.forEach(param => {
        const key = param.name || param.flag;
        values[key] = script.parameterValues?.[key] || param.defaultValue || '';
        states[key] = script.parameterStates?.[key] !== false; // default to enabled
      });
      
      setParameterValues(values);
      setParameterStates(states);
    }
  }, [script]);

  const handleParameterChange = (paramKey, value) => {
    const newValues = { ...parameterValues, [paramKey]: value };
    setParameterValues(newValues);
    
    // Auto-save to script
    onUpdateScript(script.id, {
      parameterValues: newValues,
      parameterStates: parameterStates
    });
  };

  const handleParameterToggle = (paramKey, enabled) => {
    const newStates = { ...parameterStates, [paramKey]: enabled };
    setParameterStates(newStates);
    
    // Auto-save to script
    onUpdateScript(script.id, {
      parameterValues: parameterValues,
      parameterStates: newStates
    });
  };

  const clearParameter = (paramKey) => {
    const param = script.detectedParams.find(p => (p.name || p.flag) === paramKey);
    const newValues = { ...parameterValues, [paramKey]: param?.defaultValue || '' };
    setParameterValues(newValues);
    
    onUpdateScript(script.id, {
      parameterValues: newValues,
      parameterStates: parameterStates
    });
  };

  const clearAllParameters = () => {
    const newValues = {};
    script.detectedParams.forEach(param => {
      const key = param.name || param.flag;
      newValues[key] = param.defaultValue || '';
    });
    setParameterValues(newValues);
    
    onUpdateScript(script.id, {
      parameterValues: newValues,
      parameterStates: parameterStates
    });
  };

  if (!script.detectedParams || script.detectedParams.length === 0) {
    return null;
  }

  if (isInline) {
    return (
      <>
        {/* Gear icon button in the script button row */}
        <button 
          className="tree-btn tree-btn-params"
          onClick={(e) => {
            e.stopPropagation();
            setShowParameters(!showParameters);
          }}
          title={`Parameters (${script.detectedParams.length})`}
        >
          ⚙️
        </button>
        
        {/* Collapsible parameter panel - rendered outside the script buttons */}
        {showParameters && (
          <div className="parameter-panel-overlay">
            <div className="parameter-panel-header">
              <span className="parameter-panel-title">
                {script.name} Parameters ({script.detectedParams.length})
              </span>
              <button 
                className="clear-all-btn-inline"
                onClick={clearAllParameters}
                title="Clear All Parameters"
              >
                Clear All
              </button>
            </div>
            
            <div className="parameter-list-inline">
              {script.detectedParams.map((param, index) => {
                const paramKey = param.name || param.flag;
                const isEnabled = parameterStates[paramKey] !== false;
                const value = parameterValues[paramKey] || '';
                
                return (
                  <div key={index} className={`parameter-item-inline ${!isEnabled ? 'disabled' : ''}`}>
                    <div className="parameter-controls-inline">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => handleParameterToggle(paramKey, e.target.checked)}
                        className="parameter-checkbox-inline"
                      />
                      <label 
                        className="parameter-label-inline"
                        title={`Parameter key: ${paramKey}`}
                      >
                        {getParameterDisplayName(param, index)}
                        {param.required && <span className="required">*</span>}
                      </label>
                      <button 
                        className="clear-param-btn-inline"
                        onClick={() => clearParameter(paramKey)}
                        title="Clear Parameter"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="parameter-input-row-inline">
                      {param.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={value === 'true' || value === true}
                          onChange={(e) => handleParameterChange(paramKey, e.target.checked)}
                          disabled={!isEnabled}
                          className="param-value-checkbox-inline"
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleParameterChange(paramKey, e.target.value)}
                          placeholder={param.defaultValue || getParameterDisplayName(param, index)}
                          disabled={!isEnabled}
                          className="param-value-input-inline"
                        />
                      )}
                    </div>
                    
                    {param.description && (
                      <div className="parameter-description-inline">{param.description}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  // Original standalone version (kept for backward compatibility)
  return (
    <div className="script-parameter-manager">
      <div className="parameter-header">
        <button 
          className="parameter-toggle-btn"
          onClick={() => setShowParameters(!showParameters)}
          title="Toggle Parameters"
        >
          <span className="parameter-icon">⚙️</span>
          <span className="parameter-count">({script.detectedParams.length})</span>
          <span className="parameter-arrow">{showParameters ? '▾' : '▸'}</span>
        </button>
        {showParameters && (
          <button 
            className="clear-all-btn"
            onClick={clearAllParameters}
            title="Clear All Parameters"
          >
            Clear All
          </button>
        )}
      </div>
      
      {showParameters && (
        <div className="parameter-list">
          {script.detectedParams.map((param, index) => {
            const paramKey = param.name || param.flag;
            const isEnabled = parameterStates[paramKey] !== false;
            const value = parameterValues[paramKey] || '';
            
            return (
              <div key={index} className={`parameter-item ${!isEnabled ? 'disabled' : ''}`}>
                <div className="parameter-controls">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => handleParameterToggle(paramKey, e.target.checked)}
                    className="parameter-checkbox"
                  />
                  <label 
                    className="parameter-label"
                    title={`Parameter key: ${paramKey}`}
                  >
                    {getParameterDisplayName(param, index)}
                    {param.required && <span className="required">*</span>}
                  </label>
                  <button 
                    className="clear-param-btn"
                    onClick={() => clearParameter(paramKey)}
                    title="Clear Parameter"
                  >
                    ×
                  </button>
                </div>
                
                <div className="parameter-input-row">
                  {param.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={value === 'true' || value === true}
                      onChange={(e) => handleParameterChange(paramKey, e.target.checked)}
                      disabled={!isEnabled}
                      className="param-value-checkbox"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleParameterChange(paramKey, e.target.value)}
                      placeholder={param.defaultValue || getParameterDisplayName(param, index)}
                      disabled={!isEnabled}
                      className="param-value-input"
                    />
                  )}
                </div>
                
                {param.description && (
                  <div className="parameter-description">{param.description}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScriptParameterManager;