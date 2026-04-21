import React, { useState, useEffect, useRef } from 'react';
import AddScriptModal from './AddScriptModal';
import EditScriptModal from './EditScriptModal';
import CreatePackageModal from './CreatePackageModal';
import PackageView from './PackageView';
import XTerminal from './XTerminal';

function WorkspaceDetail({ workspace, onUpdate, onDelete }) {
  const [showAddScript, setShowAddScript] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [currentPackageContext, setCurrentPackageContext] = useState('');
  const [scriptTreeCollapsed, setScriptTreeCollapsed] = useState(false);
  const [editingScript, setEditingScript] = useState(null);
  const [runningScripts, setRunningScripts] = useState(new Set());
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptTreeWidth, setScriptTreeWidth] = useState(200); // Increased default width
  const [isResizingTree, setIsResizingTree] = useState(false);
  
  // Terminal tabs state
  const [terminalTabs, setTerminalTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabLogs, setTabLogs] = useState({});
  const [tabParameters, setTabParameters] = useState({}); // Store parameter values for each tab
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('terminalTheme');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  }); // Terminal theme state
  const [autoScroll, setAutoScroll] = useState(() => {
    const saved = localStorage.getItem('terminalAutoScroll');
    return saved ? JSON.parse(saved) : true; // Default to auto-scroll enabled
  }); // Auto-scroll state
  const [useXTerm, setUseXTerm] = useState(true); // Always use XTerminal
  const [commandHistory, setCommandHistory] = useState({});
  const [historyIndex, setHistoryIndex] = useState({});
  const wsRefs = useRef({});
  const logsEndRefs = useRef({});
  const isRunningScriptRef = useRef(false); // Track if we're in the middle of running a script

  // Reset running state on mount
  useEffect(() => { setRunningScripts(new Set()); }, []);

  // Prevent panel from collapsing when there are running scripts
  useEffect(() => {
    if (runningScripts.size > 0 && scriptTreeCollapsed) {
      console.log('Auto-expanding script tree panel due to running scripts');
      setScriptTreeCollapsed(false);
    }
  }, [runningScripts, scriptTreeCollapsed]);

  // Prevent panel from collapsing when there are active terminals
  useEffect(() => {
    if (terminalTabs.length > 0 && scriptTreeCollapsed) {
      console.log('Auto-expanding script tree panel due to active terminals');
      setScriptTreeCollapsed(false);
    }
  }, [terminalTabs, scriptTreeCollapsed]);

  // Debug: Comprehensive state tracking
  useEffect(() => {
    console.log('WorkspaceDetail state:', {
      scriptTreeCollapsed,
      selectedScript: selectedScript?.name,
      runningScriptsCount: runningScripts.size,
      terminalTabsCount: terminalTabs.length,
      scriptTreeWidth
    });
  }, [scriptTreeCollapsed, selectedScript, runningScripts, terminalTabs, scriptTreeWidth]);

  // Aggressive anti-collapse protection
  useEffect(() => {
    if (scriptTreeCollapsed && (runningScripts.size > 0 || terminalTabs.length > 0 || selectedScript)) {
      console.log('AGGRESSIVE PROTECTION: Force expanding collapsed panel');
      setScriptTreeCollapsed(false);
    }
  }, [scriptTreeCollapsed, runningScripts, terminalTabs, selectedScript]);

  // Function to detect if a script is interactive
  const isInteractiveScript = (script) => {
    if (!script.filePath) return false;
    
    // Read the script content to detect interactive patterns
    try {
      // For now, we'll use heuristics based on file content
      // This could be enhanced to actually read file content via API
      const fileName = script.filePath.toLowerCase();
      const scriptName = script.name.toLowerCase();
      
      // Check for common interactive script patterns in name/path
      const interactiveKeywords = [
        'interactive', 'menu', 'prompt', 'workflow', 'wizard', 
        'ticket', 'jira', 'selection', 'choose', 'input'
      ];
      
      const hasInteractiveKeyword = interactiveKeywords.some(keyword => 
        fileName.includes(keyword) || scriptName.includes(keyword)
      );
      
      // Check for test scripts that are likely interactive
      const isTestScript = fileName.includes('test') && 
        (fileName.includes('interactive') || fileName.includes('pty'));
      
      return hasInteractiveKeyword || isTestScript;
    } catch (error) {
      console.error('Error detecting interactive script:', error);
      return false;
    }
  };

  // Enhanced function to detect interactive scripts by content
  const detectInteractiveContent = async (script) => {
    try {
      const response = await fetch('http://localhost:3001/api/analyze-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: script.filePath })
      });
      
      if (response.ok) {
        const analysis = await response.json();
        console.log(`Script analysis for ${script.name}:`, analysis);
        
        if (analysis.isInteractive && analysis.isInteractive.isInteractive) {
          console.log(`Interactive features detected:`, analysis.isInteractive.features);
          return true;
        }
      }
    } catch (error) {
      console.error('Error analyzing script content:', error);
    }
    
    // Fallback to heuristic method
    const heuristicResult = isInteractiveScript(script);
    console.log(`Heuristic detection for ${script.name}:`, heuristicResult);
    return heuristicResult;
  };

  // Resize handler
  useEffect(() => {
    if (!isResizingTree) return;
    const onMove = (e) => {
      const el = document.querySelector('.workspace-content');
      if (!el) return;
      const newWidth = Math.max(180, Math.min(400, e.clientX - el.getBoundingClientRect().left));
      setScriptTreeWidth(newWidth);
      
      // Ensure panel doesn't collapse during resize
      if (scriptTreeCollapsed && newWidth > 100) {
        setScriptTreeCollapsed(false);
      }
    };
    const onUp = () => setIsResizingTree(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isResizingTree, scriptTreeCollapsed]);

  // Auto-scroll logs for active tab
  useEffect(() => {
    if (!autoScroll) return;
    
    // Get the currently active tab
    const currentActiveTab = terminalTabs.find(tab => tab.id === activeTabId);
    
    if (currentActiveTab && logsEndRefs.current[currentActiveTab.id]) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        const element = logsEndRefs.current[currentActiveTab.id];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 10);
    }
  }, [tabLogs, autoScroll, terminalTabs, activeTabId]);

  const scrollToBottom = (tabId) => {
    if (!autoScroll) return;
    
    // Try multiple methods to ensure scrolling works
    setTimeout(() => {
      // Method 1: Scroll the logs end ref
      const endElement = logsEndRefs.current[tabId];
      if (endElement) {
        endElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      
      // Method 2: Scroll the terminal pre element
      const preElement = document.querySelector(`[data-tab-id="${tabId}"] .terminal-pre`);
      if (preElement) {
        preElement.scrollTop = preElement.scrollHeight;
      }
      
      // Method 3: Scroll the terminal logs area
      const logsArea = document.querySelector(`[data-tab-id="${tabId}"] .terminal-logs-area`);
      if (logsArea) {
        logsArea.scrollTop = logsArea.scrollHeight;
      }
      
      // Method 4: Force scroll using requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        if (endElement) {
          endElement.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      });
    }, 10);
  };

  const makeLinksClickable = (text) => {
    if (!text) return text;
    
    // First, convert ANSI escape codes to HTML
    const processedText = convertAnsiToHtml(text);
    
    // Regular expressions for different types of links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const filePathRegex = /(\/[^\s]+\.[a-zA-Z0-9]+)/g;
    const localPathRegex = /(\.\/[^\s]+)/g;
    
    let finalText = processedText;
    
    // Replace URLs
    finalText = finalText.replace(urlRegex, (match) => {
      return `<span class="terminal-link" data-link="${match}" data-type="url">${match}</span>`;
    });
    
    // Replace absolute file paths
    finalText = finalText.replace(filePathRegex, (match) => {
      return `<span class="terminal-link" data-link="${match}" data-type="file">${match}</span>`;
    });
    
    // Replace relative file paths
    finalText = finalText.replace(localPathRegex, (match) => {
      return `<span class="terminal-link" data-link="${match}" data-type="file">${match}</span>`;
    });
    
    return finalText;
  };

  const convertAnsiToHtml = (text) => {
    if (!text) return text;
    
    // ANSI color codes mapping
    const ansiColors = {
      // Standard colors
      '30': 'color: #000000', // black
      '31': 'color: #ff5555', // red
      '32': 'color: #50fa7b', // green
      '33': 'color: #f1fa8c', // yellow
      '34': 'color: #bd93f9', // blue
      '35': 'color: #ff79c6', // magenta
      '36': 'color: #8be9fd', // cyan
      '37': 'color: #f8f8f2', // white
      
      // Bright colors
      '90': 'color: #6272a4', // bright black (gray)
      '91': 'color: #ff6e6e', // bright red
      '92': 'color: #69ff94', // bright green
      '93': 'color: #ffffa5', // bright yellow
      '94': 'color: #d6acff', // bright blue
      '95': 'color: #ff92df', // bright magenta
      '96': 'color: #a4ffff', // bright cyan
      '97': 'color: #ffffff', // bright white
      
      // Background colors
      '40': 'background-color: #000000', // black bg
      '41': 'background-color: #ff5555', // red bg
      '42': 'background-color: #50fa7b', // green bg
      '43': 'background-color: #f1fa8c', // yellow bg
      '44': 'background-color: #bd93f9', // blue bg
      '45': 'background-color: #ff79c6', // magenta bg
      '46': 'background-color: #8be9fd', // cyan bg
      '47': 'background-color: #f8f8f2', // white bg
    };
    
    let result = text;
    
    // Handle ANSI escape sequences
    result = result.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      const codeList = codes.split(';');
      let styles = [];
      
      for (const code of codeList) {
        if (code === '0') {
          // Reset all formatting
          return '</span>';
        } else if (code === '1') {
          // Bold
          styles.push('font-weight: bold');
        } else if (code === '2') {
          // Dim
          styles.push('opacity: 0.7');
        } else if (code === '3') {
          // Italic
          styles.push('font-style: italic');
        } else if (code === '4') {
          // Underline
          styles.push('text-decoration: underline');
        } else if (code === '7') {
          // Reverse (invert colors)
          styles.push('filter: invert(1)');
        } else if (code === '9') {
          // Strikethrough
          styles.push('text-decoration: line-through');
        } else if (ansiColors[code]) {
          // Color codes
          styles.push(ansiColors[code]);
        }
      }
      
      if (styles.length > 0) {
        return `<span style="${styles.join('; ')}">`;
      }
      
      return '';
    });
    
    // Handle 256-color sequences (ESC[38;5;Nm for foreground, ESC[48;5;Nm for background)
    result = result.replace(/\x1b\[38;5;(\d+)m/g, (match, colorCode) => {
      const color = get256Color(parseInt(colorCode));
      return `<span style="color: ${color}">`;
    });
    
    result = result.replace(/\x1b\[48;5;(\d+)m/g, (match, colorCode) => {
      const color = get256Color(parseInt(colorCode));
      return `<span style="background-color: ${color}">`;
    });
    
    // Handle RGB color sequences (ESC[38;2;r;g;bm for foreground, ESC[48;2;r;g;bm for background)
    result = result.replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (match, r, g, b) => {
      return `<span style="color: rgb(${r}, ${g}, ${b})">`;
    });
    
    result = result.replace(/\x1b\[48;2;(\d+);(\d+);(\d+)m/g, (match, r, g, b) => {
      return `<span style="background-color: rgb(${r}, ${g}, ${b})">`;
    });
    
    // Clean up any remaining ANSI sequences that we don't handle
    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    
    return result;
  };

  const get256Color = (code) => {
    // 256-color palette mapping (simplified)
    if (code < 16) {
      // Standard colors
      const standardColors = [
        '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
        '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
      ];
      return standardColors[code] || '#ffffff';
    } else if (code < 232) {
      // 216-color cube
      const n = code - 16;
      const r = Math.floor(n / 36);
      const g = Math.floor((n % 36) / 6);
      const b = n % 6;
      const toHex = (val) => {
        const colors = [0, 95, 135, 175, 215, 255];
        return colors[val].toString(16).padStart(2, '0');
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } else {
      // Grayscale
      const gray = 8 + (code - 232) * 10;
      const hex = Math.min(255, gray).toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`;
    }
  };

  const handleTerminalClick = (e) => {
    // Only handle Cmd+click (Mac) or Ctrl+click (Windows/Linux)
    if (!(e.metaKey || e.ctrlKey)) return;
    
    const link = e.target.closest('.terminal-link');
    if (!link) return;
    
    e.preventDefault();
    const url = link.getAttribute('data-link');
    const type = link.getAttribute('data-type');
    
    if (type === 'url') {
      // Open URL in browser
      window.open(url, '_blank');
    } else if (type === 'file') {
      // Send request to backend to open file/folder
      fetch('http://localhost:3001/api/open-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: url })
      }).catch(error => {
        console.error('Error opening path:', error);
      });
    }
  };

  // Cleanup websockets on unmount
  useEffect(() => {
    return () => {
      Object.values(wsRefs.current).forEach(ws => ws && ws.close());
    };
  }, []);

  const createTerminalTab = (script, type = 'execution') => {
    const tabId = `${type}-${script.id}-${Date.now()}`;
    const tabName = type === 'execution' ? `${script.name} #${terminalTabs.filter(t => t.scriptId === script.id && t.type === 'execution').length + 1}` : `${script.name} Terminal`;
    
    // Ensure script has workspace ID for WebSocket connection
    const scriptWithWorkspace = {
      ...script,
      workspaceId: workspace.id
    };
    
    const newTab = {
      id: tabId,
      scriptId: script.id,
      script: scriptWithWorkspace,
      name: tabName,
      type: type,
      isRunning: type === 'execution',
      createdAt: Date.now()
    };

    setTerminalTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    setTabLogs(prev => ({ ...prev, [tabId]: '' }));
    
    // Initialize parameter values for this tab
    if (script.detectedParams && script.detectedParams.length > 0) {
      const initialParams = {};
      script.detectedParams.forEach(param => {
        initialParams[param.name] = param.defaultValue || '';
      });
      setTabParameters(prev => ({ ...prev, [tabId]: initialParams }));
    }

    if (type === 'execution') {
      connectWebSocket(tabId, scriptWithWorkspace);
      setRunningScripts(prev => new Set([...prev, script.id]));
      
      // Force scroll to bottom when script starts
      setTimeout(() => scrollToBottom(tabId), 100);
    } else if (type === 'terminal') {
      // XTerminal will handle its own connection
      // Force scroll to bottom when terminal opens
      setTimeout(() => scrollToBottom(tabId), 100);
    }

    return tabId;
  };

  const connectInteractiveTerminal = (tabId, script) => {
    if (wsRefs.current[tabId]) return;

    console.log(`Connecting to interactive terminal: ws://localhost:3001/terminal/${workspace.id}/${script.id}/${tabId}`);
    const ws = new WebSocket(`ws://localhost:3001/terminal/${workspace.id}/${script.id}/${tabId}`);
    wsRefs.current[tabId] = ws;
    
    ws.onopen = () => {
      console.log(`Terminal WebSocket connected for ${tabId}`);
      // Don't send initial message here, let the server handle it
    };
    
    ws.onmessage = (event) => {
      console.log(`Terminal message for ${tabId}:`, event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + data.data }));
          scrollToBottom(tabId);
        } else if (data.type === 'clear') {
          setTabLogs(prev => ({ ...prev, [tabId]: '' }));
        } else if (data.type === 'prompt') {
          setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '\n$ ' }));
          scrollToBottom(tabId);
        } else if (data.type === 'tab-complete-result') {
          // Handle tab completion result
          const inputElement = document.querySelector(`[data-tab-id="${tabId}"] .terminal-input`);
          if (inputElement) {
            inputElement.value = data.completion;
            // Move cursor to end
            inputElement.setSelectionRange(data.completion.length, data.completion.length);
          }
        }
      } catch (error) {
        console.error('Error parsing terminal message:', error);
        setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + event.data }));
        scrollToBottom(tabId);
      }
    };

    ws.onclose = () => {
      console.log(`Terminal WebSocket closed for ${tabId}`);
      delete wsRefs.current[tabId];
      setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '\n[Terminal session ended]' }));
    };

    ws.onerror = (error) => {
      console.error(`Terminal WebSocket error for ${tabId}:`, error);
      setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '\n[Terminal connection error]' }));
    };
  };

  const handleTerminalInput = (e, tabId) => {
    // Handle terminal hotkeys
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          // Ctrl+C - Send SIGINT (interrupt signal)
          e.preventDefault();
          console.log(`Sending Ctrl+C (SIGINT) to terminal ${tabId}`);
          const ws = wsRefs.current[tabId];
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }));
            setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '^C\n' }));
          }
          scrollToBottom(tabId);
          return;
          
        case 'z':
          // Ctrl+Z - Send SIGTSTP (suspend signal)
          e.preventDefault();
          console.log(`Sending Ctrl+Z (SIGTSTP) to terminal ${tabId}`);
          const wsZ = wsRefs.current[tabId];
          if (wsZ && wsZ.readyState === WebSocket.OPEN) {
            wsZ.send(JSON.stringify({ type: 'signal', signal: 'SIGTSTP' }));
            setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '^Z\n' }));
          }
          scrollToBottom(tabId);
          return;
          
        case 'd':
          // Ctrl+D - Send EOF (end of file)
          e.preventDefault();
          console.log(`Sending Ctrl+D (EOF) to terminal ${tabId}`);
          const wsD = wsRefs.current[tabId];
          if (wsD && wsD.readyState === WebSocket.OPEN) {
            wsD.send(JSON.stringify({ type: 'signal', signal: 'EOF' }));
            setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + '^D\n' }));
          }
          scrollToBottom(tabId);
          return;
          
        case 'l':
          // Ctrl+L - Clear screen
          e.preventDefault();
          console.log(`Clearing terminal ${tabId} with Ctrl+L`);
          setTabLogs(prev => ({ ...prev, [tabId]: '' }));
          const wsL = wsRefs.current[tabId];
          if (wsL && wsL.readyState === WebSocket.OPEN) {
            wsL.send(JSON.stringify({ type: 'command', data: 'clear' }));
          }
          scrollToBottom(tabId);
          return;
          
        case 'u':
          // Ctrl+U - Clear line before cursor
          e.preventDefault();
          console.log(`Clearing line with Ctrl+U in terminal ${tabId}`);
          e.target.value = '';
          return;
          
        case 'k':
          // Ctrl+K - Clear line after cursor
          e.preventDefault();
          console.log(`Clearing line after cursor with Ctrl+K in terminal ${tabId}`);
          const cursorPos = e.target.selectionStart;
          e.target.value = e.target.value.substring(0, cursorPos);
          return;
          
        case 'a':
          // Ctrl+A - Move cursor to beginning of line
          e.preventDefault();
          e.target.setSelectionRange(0, 0);
          return;
          
        case 'e':
          // Ctrl+E - Move cursor to end of line
          e.preventDefault();
          const length = e.target.value.length;
          e.target.setSelectionRange(length, length);
          return;
          
        case 'w':
          // Ctrl+W - Delete word before cursor
          e.preventDefault();
          const value = e.target.value;
          const cursor = e.target.selectionStart;
          const beforeCursor = value.substring(0, cursor);
          const afterCursor = value.substring(cursor);
          const lastSpaceIndex = beforeCursor.trimEnd().lastIndexOf(' ');
          const newValue = beforeCursor.substring(0, lastSpaceIndex + 1) + afterCursor;
          e.target.value = newValue;
          const newCursor = lastSpaceIndex + 1;
          e.target.setSelectionRange(newCursor, newCursor);
          return;
      }
    }
    
    if (e.key === 'Enter') {
      const command = e.target.value.trim();
      
      // Add command to history
      setCommandHistory(prev => ({
        ...prev,
        [tabId]: [...(prev[tabId] || []), command]
      }));
      setHistoryIndex(prev => ({ ...prev, [tabId]: -1 }));
      
      // Add command to logs with highlighting (show what user typed)
      setTabLogs(prev => ({ 
        ...prev, 
        [tabId]: (prev[tabId] || '') + `<span class="terminal-user-command">${command}</span>\n` 
      }));
      
      // Send command to backend
      const ws = wsRefs.current[tabId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`WebSocket is open, sending command: "${command}"`);
        ws.send(JSON.stringify({ type: 'command', data: command }));
      } else {
        console.error(`WebSocket not available for ${tabId}. State:`, ws?.readyState);
        setTabLogs(prev => ({ 
          ...prev, 
          [tabId]: (prev[tabId] || '') + '[Error: Terminal not connected. Try refreshing the page.]\n$ ' 
        }));
      }
      
      // Clear input
      e.target.value = '';
      
      // Force scroll to bottom after adding command
      scrollToBottom(tabId);
    } else if (e.key === 'ArrowUp') {
      // Navigate command history up
      e.preventDefault();
      const history = commandHistory[tabId] || [];
      const currentIndex = historyIndex[tabId] || -1;
      const newIndex = Math.min(currentIndex + 1, history.length - 1);
      
      if (newIndex >= 0 && history[history.length - 1 - newIndex]) {
        setHistoryIndex(prev => ({ ...prev, [tabId]: newIndex }));
        e.target.value = history[history.length - 1 - newIndex];
      }
    } else if (e.key === 'ArrowDown') {
      // Navigate command history down
      e.preventDefault();
      const history = commandHistory[tabId] || [];
      const currentIndex = historyIndex[tabId] || -1;
      const newIndex = Math.max(currentIndex - 1, -1);
      
      if (newIndex >= 0) {
        setHistoryIndex(prev => ({ ...prev, [tabId]: newIndex }));
        e.target.value = history[history.length - 1 - newIndex];
      } else {
        setHistoryIndex(prev => ({ ...prev, [tabId]: -1 }));
        e.target.value = '';
      }
    } else if (e.key === 'Tab') {
      // Basic tab completion (can be enhanced later)
      e.preventDefault();
      const command = e.target.value;
      const ws = wsRefs.current[tabId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'tab-complete', data: command }));
      }
    }
  };

  const connectWebSocket = (tabId, script) => {
    if (wsRefs.current[tabId]) return;

    const ws = new WebSocket(`ws://localhost:3001/ws/${workspace.id}/${script.id}`);
    wsRefs.current[tabId] = ws;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setTabLogs(prev => ({ ...prev, [tabId]: (prev[tabId] || '') + data.data }));
        // Force scroll to bottom after receiving script output
        scrollToBottom(tabId);
      } else if (data.type === 'status') {
        if (!data.running) {
          setTerminalTabs(prev => prev.map(tab => 
            tab.id === tabId ? { ...tab, isRunning: false } : tab
          ));
          const otherRunningTabs = terminalTabs.filter(t => t.scriptId === script.id && t.type === 'execution' && t.isRunning && t.id !== tabId);
          if (otherRunningTabs.length === 0) {
            setRunningScripts(prev => {
              const next = new Set(prev);
              next.delete(script.id);
              return next;
            });
          }
        }
      }
    };

    ws.onclose = () => {
      delete wsRefs.current[tabId];
    };
  };

  const closeTab = (tabId) => {
    const tab = terminalTabs.find(t => t.id === tabId);
    if (tab && tab.isRunning) {
      if (!window.confirm('This script is still running. Close anyway?')) return;
      handleStopScript(tab.script, tabId);
    }

    if (wsRefs.current[tabId]) {
      wsRefs.current[tabId].close();
      delete wsRefs.current[tabId];
    }

    setTerminalTabs(prev => prev.filter(t => t.id !== tabId));
    setTabLogs(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    
    // Clean up tab parameters
    setTabParameters(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    
    // Clean up command history
    setCommandHistory(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    
    setHistoryIndex(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });

    // Update active tab when closing the currently active tab
    if (activeTabId === tabId) {
      const remainingTabs = terminalTabs.filter(t => t.id !== tabId);
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null);
    }
  };

  const handleAddScript = (scriptData) => {
    const newScript = { 
      id: Date.now().toString(), 
      ...scriptData, 
      addedAt: new Date().toISOString(),
      // Ensure detectedParams is included
      detectedParams: scriptData.detectedParams || []
    };
    onUpdate({ ...workspace, scripts: [...workspace.scripts, newScript] });
    setShowAddScript(false);
    setSelectedScript(newScript);
  };

  const handleDeleteFolder = (folderPath) => {
    if (!window.confirm(`Delete folder "${folderPath}" and all its contents?`)) {
      return;
    }
    
    // Remove all scripts that belong to this folder or its subfolders
    const updatedScripts = workspace.scripts.filter(script => {
      const scriptPath = script.packagePath || '';
      // Don't delete if script is not in this folder or its subfolders
      return !scriptPath.startsWith(folderPath + '/') && scriptPath !== folderPath;
    });
    
    const updatedWorkspace = {
      ...workspace,
      scripts: updatedScripts
    };
    
    onUpdate(updatedWorkspace);
    
    // If selected script was in deleted folder, clear selection
    if (selectedScript && (selectedScript.packagePath === folderPath || 
        (selectedScript.packagePath && selectedScript.packagePath.startsWith(folderPath + '/')))) {
      setSelectedScript(null);
    }
  };

  const handleRenameFolder = (oldFolderPath, newFolderName) => {
    // Validate new folder name
    if (!newFolderName || newFolderName.includes('/')) {
      alert('Invalid folder name. Folder names cannot contain forward slashes.');
      return;
    }

    // Calculate new folder path
    const pathParts = oldFolderPath.split('/');
    pathParts[pathParts.length - 1] = newFolderName;
    const newFolderPath = pathParts.join('/');

    // Check if new folder path already exists
    const existingFolder = workspace.scripts.some(script => {
      const scriptPath = script.packagePath || '';
      return scriptPath === newFolderPath || scriptPath.startsWith(newFolderPath + '/');
    });

    if (existingFolder && newFolderPath !== oldFolderPath) {
      alert('A folder with this name already exists.');
      return;
    }

    // Update all scripts that belong to this folder or its subfolders
    const updatedScripts = workspace.scripts.map(script => {
      const scriptPath = script.packagePath || '';
      
      if (scriptPath === oldFolderPath) {
        // Script is directly in the renamed folder
        return { ...script, packagePath: newFolderPath };
      } else if (scriptPath.startsWith(oldFolderPath + '/')) {
        // Script is in a subfolder of the renamed folder
        const relativePath = scriptPath.substring(oldFolderPath.length + 1);
        return { ...script, packagePath: `${newFolderPath}/${relativePath}` };
      }
      
      return script;
    });

    const updatedWorkspace = {
      ...workspace,
      scripts: updatedScripts
    };

    onUpdate(updatedWorkspace);

    // Update selected script if it was in the renamed folder
    if (selectedScript && selectedScript.packagePath) {
      if (selectedScript.packagePath === oldFolderPath) {
        setSelectedScript({ ...selectedScript, packagePath: newFolderPath });
      } else if (selectedScript.packagePath.startsWith(oldFolderPath + '/')) {
        const relativePath = selectedScript.packagePath.substring(oldFolderPath.length + 1);
        setSelectedScript({ ...selectedScript, packagePath: `${newFolderPath}/${relativePath}` });
      }
    }
  };

  const handleCreateFolderInPackage = (parentPackage) => {
    setCurrentPackageContext(parentPackage);
    setShowCreatePackage(true);
  };

  const handleCreatePackage = (packagePath) => {
    // Create a placeholder script in the new package to make it visible
    // This will be removed once we have proper empty folder support
    const placeholderScript = {
      id: `placeholder-${Date.now()}`,
      name: '.folder-placeholder',
      description: 'Folder placeholder - will be hidden',
      filePath: '',
      packagePath: packagePath,
      type: 'placeholder',
      isPlaceholder: true,
      addedAt: new Date().toISOString(),
      detectedParams: []
    };
    
    // Add the placeholder to create the folder structure
    const updatedWorkspace = {
      ...workspace,
      scripts: [...workspace.scripts, placeholderScript]
    };
    
    onUpdate(updatedWorkspace);
    setShowCreatePackage(false);
  };

  const handleMoveScript = (scriptIdOrFolder, targetPath, type = 'script') => {
    if (type === 'folder') {
      // Move folder and all its contents
      const folder = scriptIdOrFolder;
      const folderPath = folder.fullPath;
      
      const updatedScripts = workspace.scripts.map(script => {
        const scriptPath = script.packagePath || '';
        
        // If script is in the dragged folder or its subfolders
        if (scriptPath === folderPath || scriptPath.startsWith(folderPath + '/')) {
          const relativePath = scriptPath === folderPath ? '' : scriptPath.substring(folderPath.length + 1);
          const newPath = targetPath ? 
            (relativePath ? `${targetPath}/${folder.name}/${relativePath}` : `${targetPath}/${folder.name}`) : 
            folder.name;
          return { ...script, packagePath: newPath };
        }
        
        return script;
      });
      
      onUpdate({ ...workspace, scripts: updatedScripts });
    } else {
      // Move single script
      const updatedScripts = workspace.scripts.map(script => 
        script.id === scriptIdOrFolder 
          ? { ...script, packagePath: targetPath }
          : script
      );
      
      onUpdate({ ...workspace, scripts: updatedScripts });
    }
  };

  const handleRunScript = async (script) => {
    console.log('handleRunScript called for:', script.name);
    
    // Set flag to prevent collapse during script execution
    isRunningScriptRef.current = true;
    
    // Don't force script selection - let user browse other scripts while this one runs
    // setSelectedScript(script);
    
    // Ensure script tree panel is not collapsed when running a script
    setScriptTreeCollapsed(false);
    
    // Add a timeout to ensure the panel stays expanded
    setTimeout(() => {
      console.log('Timeout check - ensuring panel is expanded');
      setScriptTreeCollapsed(false);
      isRunningScriptRef.current = false; // Clear flag after timeout
    }, 500);
    
    // Always use terminal mode for all scripts (like manual execution)
    console.log(`Running script in terminal mode: ${script.name}`);
    
    // Create terminal tab and auto-execute the script
    const tabId = createTerminalTab(script, 'terminal');
    
    // Wait a moment for terminal to initialize, then send the command
    setTimeout(() => {
      // Build the command with parameters
      let command = script.filePath;
      
      // Add parameters if any
      const paramArray = [];
      if (script.detectedParams && script.detectedParams.length > 0) {
        script.detectedParams.forEach(param => {
          const paramKey = param.name || param.flag;
          const isEnabled = script.parameterStates?.[paramKey] !== false;
          const value = script.parameterValues?.[paramKey];
          
          if (isEnabled && value) {
            if (param.flag) {
              if (param.type === 'checkbox') {
                if (value === true || value === 'true') {
                  paramArray.push(param.flag);
                }
              } else {
                paramArray.push(param.flag, value);
              }
            } else {
              paramArray.push(value);
            }
          }
        });
      }
      
      if (paramArray.length > 0) {
        command += ' ' + paramArray.join(' ');
      }
      
      // Find the XTerminal component and send the command directly
      console.log(`Auto-executing script: ${command}`);
      console.log(`Tab ID: ${tabId}`);
      
      // We'll use a custom event to communicate with XTerminal
      const event = new CustomEvent('executeCommand', {
        detail: { tabId, command }
      });
      window.dispatchEvent(event);
      
    }, 2000); // Wait 2 seconds for terminal to be ready
  };

  const handleStopScript = async (script, specificTabId = null) => {
    try {
      await fetch('http://localhost:3001/api/script/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id, scriptId: script.id })
      });
      
      if (specificTabId) {
        setTerminalTabs(prev => prev.map(tab => 
          tab.id === specificTabId ? { ...tab, isRunning: false } : tab
        ));
      } else {
        setTerminalTabs(prev => prev.map(tab => 
          tab.scriptId === script.id && tab.type === 'execution' ? { ...tab, isRunning: false } : tab
        ));
      }
      
      setRunningScripts(prev => {
        const next = new Set(prev);
        next.delete(script.id);
        return next;
      });
    } catch (error) {
      console.error('Error stopping script:', error);
    }
  };

  const handleAddTerminal = (script) => {
    // Don't force script selection - let user stay on current script while adding terminals
    // setSelectedScript(script);
    
    // Ensure script tree panel is not collapsed when adding a terminal
    setScriptTreeCollapsed(false);
    
    createTerminalTab(script, 'terminal');
  };

  const handleEditScript = (script) => {
    setEditingScript(script);
    setShowEditModal(true);
  };

  const handleUpdateScript = (scriptId, updates) => {
    const updatedWorkspace = { ...workspace, scripts: workspace.scripts.map(s => s.id === scriptId ? { ...s, ...updates } : s) };
    onUpdate(updatedWorkspace);
    if (selectedScript && selectedScript.id === scriptId) setSelectedScript({ ...selectedScript, ...updates });
  };

  const handleDeleteScript = async (script) => {
    if (!window.confirm(`Delete "${script.name}"?`)) return;
    
    const scriptTabs = terminalTabs.filter(t => t.scriptId === script.id);
    for (const tab of scriptTabs) {
      if (tab.isRunning) await handleStopScript(script, tab.id);
      closeTab(tab.id);
    }
    
    const updated = { ...workspace, scripts: workspace.scripts.filter(s => s.id !== script.id) };
    onUpdate(updated);
    const nr = new Set(runningScripts); nr.delete(script.id); setRunningScripts(nr);
    if (selectedScript && selectedScript.id === script.id) {
      setSelectedScript(updated.scripts.length > 0 ? updated.scripts[0] : null);
    }
  };

  // Get terminals for the currently selected script
  const getScriptTerminals = () => {
    if (!selectedScript) return [];
    return terminalTabs.filter(tab => tab.scriptId === selectedScript.id);
  };

  // Get active tab (from any script)
  const getActiveScriptTab = () => {
    return terminalTabs.find(tab => tab.id === activeTabId) || null;
  };

  // Update active tab when script selection changes
  useEffect(() => {
    if (selectedScript) {
      // Ensure script tree panel is not collapsed when selecting a script
      if (scriptTreeCollapsed) {
        setScriptTreeCollapsed(false);
      }
      
      // Don't automatically switch terminal tabs when selecting a different script.
      // Let the user manually click on tabs to switch between terminals.
      // This preserves the current terminal session when browsing scripts.
    }
  }, [selectedScript, scriptTreeCollapsed]);

  const clearTabLogs = (tabId) => {
    setTabLogs(prev => ({ ...prev, [tabId]: '' }));
  };

  const scriptTerminals = getScriptTerminals();
  const activeTab = getActiveScriptTab();
  const currentLogs = activeTab ? (tabLogs[activeTab.id] || '') : '';

  return (
    <div className="workspace-detail">
      <div className="workspace-content">
        <div className={`script-tree-panel ${scriptTreeCollapsed ? 'collapsed' : ''}`} style={{ width: scriptTreeCollapsed ? '50px' : `${scriptTreeWidth}px` }}>
          <div className="tree-panel-header">
            <div className="workspace-title-row">
              {!scriptTreeCollapsed && (
                <div className="package-actions">
                  <div className="package-add-dropdown">
                    <button 
                      className="package-add-btn tooltip-container" 
                      data-tooltip="Add Script or Folder"
                    >
                      +
                    </button>
                    <div className="package-add-dropdown-menu">
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setCurrentPackageContext(''); // Add to root level
                          setShowAddScript(true);
                        }}
                      >
                        📄 Add Script
                      </button>
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setCurrentPackageContext(''); // Create folder at root level
                          setShowCreatePackage(true);
                        }}
                      >
                        📁 Create Folder
                      </button>
                    </div>
                  </div>
                  <button 
                    className="package-rename-folder-btn tooltip-container" 
                    data-tooltip="Rename Workspace"
                  >
                    ✎
                  </button>
                  <button 
                    className="package-delete-folder-btn tooltip-container" 
                    data-tooltip="Delete Workspace"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="collapsible-header" onClick={() => {
                // Prevent collapse if we're in the middle of running a script
                if (isRunningScriptRef.current) {
                  console.log('Preventing collapse - script is being executed');
                  return;
                }
                // Prevent collapse if there are running scripts or active terminals
                if (runningScripts.size > 0 || terminalTabs.length > 0) {
                  console.log('Preventing collapse - active scripts or terminals exist');
                  return;
                }
                setScriptTreeCollapsed(!scriptTreeCollapsed);
              }}>
                <span className="collapse-arrow">{scriptTreeCollapsed ? '▸' : '▾'}</span>
                {!scriptTreeCollapsed && <h3>{workspace.name}</h3>}
              </div>
            </div>
          </div>
          
          {!scriptTreeCollapsed && (
            <>
              {workspace.scripts.length === 0 ? (
                <div className="empty-state">
                  <p>No scripts yet</p>
                </div>
              ) : (
                <div className="script-tree">
                  <PackageView
                    scripts={workspace.scripts}
                    terminalTabs={terminalTabs}
                    onScriptSelect={setSelectedScript}
                    selectedScript={selectedScript}
                    runningScripts={runningScripts}
                    onRunScript={handleRunScript}
                    onStopScript={handleStopScript}
                    onEditScript={handleEditScript}
                    onDeleteScript={handleDeleteScript}
                    onAddTerminal={handleAddTerminal}
                    onUpdateScript={handleUpdateScript}
                    onCreateFolder={handleCreateFolderInPackage}
                    onDeleteFolder={handleDeleteFolder}
                    onRenameFolder={handleRenameFolder}
                    onAddScript={(packagePath) => {
                      setCurrentPackageContext(packagePath);
                      setShowAddScript(true);
                    }}
                    onMoveScript={handleMoveScript}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Collapsed state - show minimal workspace info */}
          {scriptTreeCollapsed && (
            <div className="script-tree-collapsed">
              <div 
                className="workspace-icon-collapsed" 
                title={`${workspace.name} - ${workspace.scripts.length} scripts`}
                onClick={() => setScriptTreeCollapsed(false)}
              >
                📁
              </div>
              <div 
                className="script-count-collapsed" 
                title={`${workspace.scripts.length} scripts in this workspace`}
                onClick={() => setScriptTreeCollapsed(false)}
              >
                {workspace.scripts.length}
              </div>
            </div>
          )}
          
          {/* Action buttons at bottom in column layout */}
          {!scriptTreeCollapsed && (
            <div className="tree-panel-actions-bottom">
              {/* Actions moved to header */}
            </div>
          )}
        </div>

        <div className={`script-tree-resize-handle ${scriptTreeCollapsed ? 'disabled' : ''}`} onMouseDown={scriptTreeCollapsed ? undefined : () => setIsResizingTree(true)} />

        <div className="terminal-panel">
          {!selectedScript ? (
            <div className="terminal-empty">
              <div className="empty-terminal">
                <p>Select a script to view its terminals</p>
              </div>
            </div>
          ) : terminalTabs.length > 0 ? (
            <div className="terminal-tabs-container">
              <div className="terminal-tabs-header">
                {terminalTabs.map(tab => (
                  <div 
                    key={tab.id}
                    className={`terminal-tab ${activeTab && activeTab.id === tab.id ? 'active' : ''} ${tab.scriptId === selectedScript?.id ? 'current-script' : 'other-script'}`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <span className="tab-icon">
                      {tab.type === 'execution' ? (tab.isRunning ? '▶' : '■') : '⚡'}
                    </span>
                    <span className="tab-name">{tab.name}</span>
                    <button 
                      className="tab-close"
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                      title="Close tab"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {selectedScript && (
                  <button 
                    className="terminal-add-tab"
                    onClick={() => handleAddTerminal(selectedScript)}
                    title="Add new terminal for this script"
                  >
                    +
                  </button>
                )}
              </div>

              {terminalTabs.map(tab => (
                <div
                  key={tab.id}
                  style={{ display: tab.id === activeTab?.id ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
                >
                  <XTerminal
                    tabId={tab.id}
                    script={{...tab.script, workspaceId: workspace.id}}
                    type={tab.type}
                    isDarkMode={isDarkMode}
                    isVisible={tab.id === activeTab?.id}
                    onClose={() => closeTab(tab.id)}
                    onToggleTheme={() => {
                      const newTheme = !isDarkMode;
                      setIsDarkMode(newTheme);
                      localStorage.setItem('terminalTheme', JSON.stringify(newTheme));
                    }}
                    onCommand={(command, data) => {
                      if (command === 'process_completed') {
                        setTerminalTabs(prev => prev.map(t => 
                          t.id === data.tabId ? { ...t, isRunning: false } : t
                        ));
                        setRunningScripts(prev => {
                          const next = new Set(prev);
                          next.delete(data.script.id);
                          return next;
                        });
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="terminal-empty">
              <div className="empty-terminal">
                <p>No terminals for "{selectedScript.name}"</p>
                <p>Press ▶ to run the script or ⚡ to add a terminal</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddScript && (
        <AddScriptModal 
          onClose={() => setShowAddScript(false)} 
          onAdd={handleAddScript} 
          currentPackage={currentPackageContext}
        />
      )}
      {showCreatePackage && (
        <CreatePackageModal 
          onClose={() => setShowCreatePackage(false)} 
          onCreate={handleCreatePackage}
          parentPackage={currentPackageContext}
        />
      )}
      {showEditModal && editingScript && (
        <EditScriptModal
          script={editingScript}
          onClose={() => { setShowEditModal(false); setEditingScript(null); }}
          onUpdate={(updates) => { handleUpdateScript(editingScript.id, updates); setEditingScript(null); }}
        />
      )}
    </div>
  );
}

export default WorkspaceDetail;