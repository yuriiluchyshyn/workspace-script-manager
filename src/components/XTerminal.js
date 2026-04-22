import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

const getTheme = (isDarkMode) => (isDarkMode ? {
  background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#ffffff', selection: '#264f78',
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8',
  magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5', brightBlack: '#666666',
  brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea',
  brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5'
} : {
  background: '#ffffff', foreground: '#333333', cursor: '#000000', selection: '#b3d4fc',
  black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800', blue: '#0451a5',
  magenta: '#bc05bc', cyan: '#0598bc', white: '#555555'
});

function XTerminal({ 
  tabId, 
  script, 
  type = 'terminal', 
  isDarkMode = true, 
  isVisible = true,
  onClose,
  onCommand,
  onToggleTheme
}) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Re-fit terminal when it becomes visible (switching tabs)
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current.fit(); } catch (e) {}
      }, 50);
    }
  }, [isVisible]);

  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!terminalRef.current) return;

    let destroyed = false; // guard against StrictMode double-invoke

    const terminal = new Terminal({
      theme: getTheme(isDarkMode),
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4,
      convertEol: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (event.metaKey || event.ctrlKey) {
        if (uri.startsWith('http')) {
          window.open(uri, '_blank');
        } else {
          fetch('http://localhost:3001/api/open-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: uri })
          }).catch(console.error);
        }
      }
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);

    // ==========================================
    // ФІКС ГАРЯЧИХ КЛАВІШ (КОПІЮВАННЯ / ВСТАВКА / СИСТЕМНІ)
    // ==========================================
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier) {
        // Ctrl+C: Копіювати, якщо є виділення. Якщо немає — передати в термінал (SIGINT)
        if (event.code === 'KeyC') {
          if (terminal.hasSelection()) {
            const text = terminal.getSelection();
            if (navigator.clipboard) {
              navigator.clipboard.writeText(text).catch(() => document.execCommand('copy'));
            } else {
              document.execCommand('copy');
            }
            terminal.clearSelection();
            return false; // Не даємо події йти далі, щоб не відправити ^C в процес
          }
          return true; // Передаємо Ctrl+C в термінал для зупинки процесу
        }

        // Ctrl+V: Let xterm handle paste natively via onData handler
        if (event.code === 'KeyV') {
          return true; // Allow default xterm paste behavior
        }

        // Ctrl+X, Ctrl+A, Ctrl+Z, Ctrl+L, Ctrl+W, Ctrl+U, Ctrl+R: 
        // Дозволяємо терміналу їх обробляти (вони потраплять в onData)
        const terminalKeys = ['KeyX', 'KeyA', 'KeyZ', 'KeyL', 'KeyW', 'KeyU', 'KeyR'];
        if (terminalKeys.includes(event.code)) {
          // Якщо це Ctrl+R, ми можемо захотіти заблокувати оновлення сторінки браузером
          if (event.code === 'KeyR') event.preventDefault();
          return true; 
        }
      }

      // Дозволяємо стандартні F-клавіші
      if (event.key.startsWith('F')) return true;

      return true; // Всі інші клавіші передаємо у термінал
    });
    // ==========================================
    
    fitAddon.fit();
    setTimeout(() => fitAddon.fit(), 50);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const workspaceId = script.workspaceId || 'default';
    const wsUrl = type === 'execution' 
      ? `ws://localhost:3001/ws/${workspaceId}/${script.id}`
      : `ws://localhost:3001/terminal/${workspaceId}/${script.id}/${tabId}`;
    
    console.log(`XTerminal connecting to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Guard: if component was destroyed before WS connected, close immediately
    if (destroyed) {
      ws.close();
      return;
    }

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!destroyed && ws.readyState === WebSocket.CONNECTING) {
        console.error(`XTerminal connection timeout for: ${wsUrl}`);
        ws.close();
        setIsConnected(false);
        terminal.writeln('\n[Connection timeout - server may be unavailable]');
      }
    }, 10000);

    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    ws.onopen = () => {
      console.log(`XTerminal WebSocket connected to: ${wsUrl}`);
      clearTimeout(connectionTimeout);
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));

      if (type === 'terminal') {
        terminal.writeln(`Terminal for ${script.name}`);
        terminal.writeln(`Location: ${script.filePath || 'Unknown'}\n`);
      } else {
        terminal.writeln(`Running ${script.name}...\n`);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'output':
          case 'log':
            terminal.write(data.data);
            break;
          case 'clear':
            terminal.clear();
            break;
          case 'prompt':
            terminal.write('\n$ ');
            break;
          case 'status':
            if (type === 'execution' && !data.running) {
              terminal.writeln('\n[Process completed]');
              if (onCommandRef.current) {
                onCommandRef.current('process_completed', { tabId, script });
              }
            }
            break;
          default:
            terminal.write(data.data || event.data);
        }
      } catch (error) {
        terminal.write(event.data);
      }
    };

    ws.onclose = () => {
      console.log(`XTerminal WebSocket closed for: ${wsUrl}`);
      clearTimeout(connectionTimeout);
      setIsConnected(false);
      terminal.writeln('\n[Connection closed]');
    };

    ws.onerror = (error) => {
      console.error(`XTerminal WebSocket error for: ${wsUrl}`, error);
      clearTimeout(connectionTimeout);
      setIsConnected(false);
      terminal.writeln('\n[Connection error - check server status]');
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Listen for custom executeCommand events
    const handleExecuteCommand = (event) => {
      if (event.detail.tabId === tabId) {
        console.log(`XTerminal received executeCommand event for tabId: ${tabId}`);
        console.log(`Command: ${event.detail.command}`);
        console.log(`WebSocket state: ${ws.readyState}`);
        
        if (ws.readyState === WebSocket.OPEN) {
          console.log(`Executing command: ${event.detail.command}`);
          ws.send(JSON.stringify({ type: 'input', data: event.detail.command + '\r' }));
        } else {
          console.warn(`WebSocket not ready for command execution. State: ${ws.readyState}`);
          terminal.writeln(`\n[Warning: Terminal not ready. WebSocket state: ${ws.readyState}]`);
          
          // Retry after a short delay if connecting
          if (ws.readyState === WebSocket.CONNECTING) {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                console.log(`Retrying command execution: ${event.detail.command}`);
                ws.send(JSON.stringify({ type: 'input', data: event.detail.command + '\r' }));
              }
            }, 1000);
          }
        }
      }
    };

    window.addEventListener('executeCommand', handleExecuteCommand);

    // Debounced ResizeObserver — avoids "loop completed" errors when many
    // terminals are mounted but hidden
    let resizeTimer = null;
    const resizeObserver = new ResizeObserver(() => {
      if (!isVisible) return; // skip hidden terminals
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try { if (fitAddonRef.current) fitAddonRef.current.fit(); } catch (e) {}
      }, 50);
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      destroyed = true;
      clearTimeout(resizeTimer);
      window.removeEventListener('executeCommand', handleExecuteCommand);
      resizeObserver.disconnect();
      clearTimeout(connectionTimeout);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      terminal.dispose();
    };
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, script.id, type]); 

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTheme(isDarkMode);
    }
  }, [isDarkMode]);

  const handleClear = () => {
    if (xtermRef.current) xtermRef.current.clear();
  };

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Дублюємо відправку \x03 і сигналу при ручному натисканні кнопки Stop
      wsRef.current.send(JSON.stringify({ type: 'input', data: '\x03' }));
      wsRef.current.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }));
    }
  };

  return (
    <div className="xterm-container">
      <div className="xterm-toolbar">
        <span className="xterm-title">
          {script.name} {type === 'execution' ? '(Script)' : '(Terminal)'}
          {isConnected ? ' ●' : ' ○'}
        </span>
        <div className="xterm-controls">
          {type === 'execution' && (
            <button className="btn btn-danger btn-small" onClick={handleStop} title="Stop process (Ctrl+C)">
              Stop
            </button>
          )}
          <button 
            className="btn btn-secondary btn-small" 
            onClick={onToggleTheme} 
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-secondary btn-small" onClick={handleClear} title="Clear terminal">
            Clear
          </button>

        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="xterm-terminal"
        style={{ height: 'calc(100% - 40px)', width: '100%', overflow: 'hidden' }}
      />
    </div>
  );
}

export default XTerminal;