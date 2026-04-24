const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');

// Ignore SIGHUP so PTY child sessions closing don't kill the backend.
// This happens when a script run via the UI terminal exits — the PTY
// sends SIGHUP to its process group which includes this server.
process.on('SIGHUP', () => {
  console.log('[server] SIGHUP received — ignoring (PTY child session closed)');
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Configuration file paths
// User-level config: ~/runner-yl/config.json defines where data is stored
const USER_CONFIG_DIR = path.join(os.homedir(), 'runner-yl');
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, 'config.json');

// Ensure user config directory exists
if (!fs.existsSync(USER_CONFIG_DIR)) {
  fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
}

// Load or create user config
let userConfig = { dataDir: USER_CONFIG_DIR };
if (fs.existsSync(USER_CONFIG_FILE)) {
  try {
    userConfig = { ...userConfig, ...JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf8')) };
  } catch (error) {
    console.error('Error reading user config, using defaults:', error.message);
  }
} else {
  // Create default config file
  fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify({ dataDir: USER_CONFIG_DIR }, null, 2));
  console.log(`Created default config at: ${USER_CONFIG_FILE}`);
}

const DATA_DIR = userConfig.dataDir;
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`[server] User config: ${USER_CONFIG_FILE}`);
console.log(`[server] Data directory: ${DATA_DIR}`);
console.log(`[server] Workspaces file: ${WORKSPACES_FILE}`);

// Default settings
const DEFAULT_SETTINGS = {
  nodePath: 'node', // Default to system node
  pythonPath: 'python3'
};

// Store running processes
const runningProcesses = new Map();
const workspaceProcesses = new Map();

// WebSocket connections for each script
const scriptConnections = new Map();
// Interactive terminal connections
const terminalConnections = new Map();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  
  // Handle script execution WebSocket connections
  if (pathParts[1] === 'ws' && pathParts.length === 4) {
    const workspaceId = pathParts[2];
    const scriptId = pathParts[3];
    const key = `${workspaceId}-${scriptId}`;
    
    if (!scriptConnections.has(key)) {
      scriptConnections.set(key, new Set());
    }
    scriptConnections.get(key).add(ws);
    
    // Send current status
    const processKey = `${workspaceId}-${scriptId}`;
    const isRunning = runningProcesses.has(processKey);
    ws.send(JSON.stringify({ type: 'status', running: isRunning }));
    
    ws.on('close', () => {
      if (scriptConnections.has(key)) {
        scriptConnections.get(key).delete(ws);
        if (scriptConnections.get(key).size === 0) {
          scriptConnections.delete(key);
        }
      }
    });
  }
  
  // Handle interactive terminal WebSocket connections
  else if (pathParts[1] === 'terminal' && pathParts.length === 5) {
    const workspaceId = pathParts[2];
    const scriptId = pathParts[3];
    const terminalId = pathParts[4];
    const key = `${workspaceId}-${scriptId}-${terminalId}`;
    
    // Determine shell
    const shell = process.env.SHELL || '/bin/bash';
    
    // Build a clean environment for the PTY.
    // Remove npm/node lifecycle env vars that leak from the backend process
    // so that scripts running inside the PTY don't interfere with the backend.
    const cleanEnv = { ...process.env };
    Object.keys(cleanEnv).forEach(k => {
      if (k.startsWith('npm_') || k === 'NODE_ENV' || k === 'INIT_CWD' || k === 'npm_execpath') {
        delete cleanEnv[k];
      }
    });
    cleanEnv.TERM = 'xterm-256color';
    cleanEnv.HOME = process.env.HOME || os.homedir();
    
    // Spawn a real pseudo-terminal
    let ptyProcess;
    let ptyAlive = true;
    try {
      ptyProcess = pty.spawn(shell, ['--login'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cleanEnv.HOME,
        env: cleanEnv
      });
    } catch (error) {
      console.error(`Failed to spawn PTY for ${key}:`, error);
      ws.close();
      return;
    }

    terminalConnections.set(key, { ws, process: ptyProcess });

    // Forward PTY output to WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      ptyAlive = false;
      console.log(`PTY exited for ${key}: code=${exitCode}, signal=${signal}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: `\r\n[Process exited with code ${exitCode}]\r\n` }));
      }
    });

    // Handle messages from frontend
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'input') {
          if (ptyAlive) ptyProcess.write(data.data);
        } else if (data.type === 'resize') {
          const cols = Math.max(data.cols || 80, 1);
          const rows = Math.max(data.rows || 24, 1);
          if (ptyAlive) ptyProcess.resize(cols, rows);
        } else if (data.type === 'signal') {
          if (!ptyAlive) return;
          if (data.signal === 'SIGINT') {
            ptyProcess.write('\x03');
          } else if (data.signal === 'SIGTSTP') {
            ptyProcess.write('\x1a');
          } else if (data.signal === 'EOF') {
            ptyProcess.write('\x04');
          }
        } else if (data.type === 'command') {
          if (ptyAlive) ptyProcess.write(data.data + '\r');
        }
      } catch (error) {
        console.error('Error processing terminal message:', error);
      }
    });
    
    // Graceful PTY cleanup: send SIGHUP only to the PTY child, not the
    // whole process group, and give it time to exit before force-killing.
    const cleanupPty = () => {
      if (!ptyAlive) return;
      terminalConnections.delete(key);
      
      // First try: send "exit" to the shell so it cleans up children gracefully
      try { ptyProcess.write('exit\r'); } catch (e) {}
      
      // After 2s, if still alive, kill the PTY process directly
      setTimeout(() => {
        if (ptyAlive) {
          try { process.kill(ptyProcess.pid, 'SIGTERM'); } catch (e) {}
        }
        // After another 2s, force kill
        setTimeout(() => {
          if (ptyAlive) {
            try { process.kill(ptyProcess.pid, 'SIGKILL'); } catch (e) {}
          }
        }, 2000);
      }, 2000);
    };

    ws.on('close', () => {
      console.log(`Terminal WebSocket closed for ${key}`);
      cleanupPty();
    });
    
    ws.on('error', (error) => {
      console.error(`Terminal WebSocket error for ${key}:`, error);
      cleanupPty();
    });
  }
});

function broadcastToScript(workspaceId, scriptId, message) {
  const key = `${workspaceId}-${scriptId}`;
  const connections = scriptConnections.get(key);
  if (connections) {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}

function broadcastStatus(workspaceId, scriptId, running) {
  broadcastToScript(workspaceId, scriptId, { type: 'status', running });
}

function broadcastLog(workspaceId, scriptId, data) {
  broadcastToScript(workspaceId, scriptId, { type: 'log', data });
}

// Storage functions
function loadWorkspacesFromFile() {
  try {
    if (fs.existsSync(WORKSPACES_FILE)) {
      const data = fs.readFileSync(WORKSPACES_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading workspaces from file:', error);
    return [];
  }
}

function saveWorkspacesToFile(workspaces) {
  try {
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving workspaces to file:', error);
    return false;
  }
}

// Settings functions
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings from file:', error);
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try {
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(mergedSettings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings to file:', error);
    return false;
  }
}

// Settings endpoints
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  const success = saveSettings(settings);
  
  if (success) {
    res.json({ success: true, message: 'Settings saved successfully' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// Workspace configuration endpoints
app.get('/api/workspaces', (req, res) => {
  const workspaces = loadWorkspacesFromFile();
  res.json(workspaces);
});

app.post('/api/workspaces', (req, res) => {
  const workspaces = req.body;
  const success = saveWorkspacesToFile(workspaces);
  
  if (success) {
    res.json({ success: true, message: 'Workspaces saved successfully' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save workspaces' });
  }
});

// Export/Import endpoints
app.get('/api/export', (req, res) => {
  const workspaces = loadWorkspacesFromFile();
  const exportData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    workspaces: workspaces
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="workspace-config.json"');
  res.json(exportData);
});

// Discover scripts endpoint
app.get('/api/discover-scripts', (req, res) => {
  const searchPaths = [
    './examples',
    './scripts',
    '.',
    '../scripts'
  ];
  
  const foundScripts = [];
  
  searchPaths.forEach(searchPath => {
    try {
      const resolvedPath = path.resolve(searchPath);
      if (fs.existsSync(resolvedPath)) {
        const files = fs.readdirSync(resolvedPath);
        files.forEach(file => {
          const filePath = path.join(resolvedPath, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isFile() && (file.endsWith('.sh') || file.endsWith('.py') || file.endsWith('.cjs') || file.endsWith('.js'))) {
            const relativePath = path.relative(process.cwd(), filePath);
            let scriptType = 'sh';
            if (file.endsWith('.py')) scriptType = 'py';
            else if (file.endsWith('.cjs')) scriptType = 'cjs';
            else if (file.endsWith('.js')) scriptType = 'js';
            
            foundScripts.push({
              name: file.replace(/\.[^/.]+$/, ""),
              fileName: file,
              absolutePath: filePath,
              relativePath: relativePath.startsWith('.') ? relativePath : `./${relativePath}`,
              type: scriptType,
              directory: searchPath,
              size: stats.size,
              modified: stats.mtime
            });
          }
        });
      }
    } catch (error) {
      // Ignore errors for directories that don't exist or can't be read
    }
  });
  
  res.json({
    scripts: foundScripts,
    searchPaths: searchPaths,
    cwd: process.cwd(),
    platform: process.platform,
    pathSeparator: path.sep
  });
});

// Path validation endpoint
app.post('/api/validate-path', (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ valid: false, error: 'No file path provided' });
  }
  
  let resolvedPath;
  try {
    if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      resolvedPath = path.resolve(process.cwd(), filePath);
    }
    
    const exists = fs.existsSync(resolvedPath);
    
    if (!exists) {
      return res.json({
        valid: false,
        error: 'File not found',
        originalPath: filePath,
        resolvedPath: resolvedPath,
        cwd: process.cwd()
      });
    }
    
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.json({
        valid: false,
        error: 'Path is not a file',
        originalPath: filePath,
        resolvedPath: resolvedPath
      });
    }
    
    // Check if it's a script file
    const isScript = resolvedPath.endsWith('.sh') || resolvedPath.endsWith('.py') || resolvedPath.endsWith('.cjs') || resolvedPath.endsWith('.js');
    if (!isScript) {
      return res.json({
        valid: false,
        error: 'File is not a script (.sh, .py, .cjs, or .js)',
        originalPath: filePath,
        resolvedPath: resolvedPath
      });
    }
    
    let scriptType = 'sh';
    if (resolvedPath.endsWith('.py')) scriptType = 'py';
    else if (resolvedPath.endsWith('.cjs')) scriptType = 'cjs';
    else if (resolvedPath.endsWith('.js')) scriptType = 'js';
    
    res.json({
      valid: true,
      originalPath: filePath,
      resolvedPath: resolvedPath,
      type: scriptType,
      size: stats.size,
      modified: stats.mtime
    });
    
  } catch (error) {
    res.json({
      valid: false,
      error: error.message,
      originalPath: filePath,
      resolvedPath: resolvedPath || 'Could not resolve'
    });
  }
});

// Get current working directory info
app.get('/api/path-info', (req, res) => {
  res.json({
    cwd: process.cwd(),
    platform: process.platform,
    pathSeparator: path.sep,
    homeDir: require('os').homedir(),
    example: {
      absolute: process.platform === 'win32' ? 'C:\\path\\to\\script.sh' : '/full/path/to/script.sh',
      relative: './script.sh',
      home: '~/scripts/script.sh'
    }
  });
});

// Get current working directory for file picker
app.get('/api/current-dir', (req, res) => {
  res.json({
    currentDir: process.cwd(),
    platform: process.platform,
    homeDir: require('os').homedir()
  });
});

// Kill all processes
app.post('/api/kill-all', (req, res) => {
  try {
    runningProcesses.forEach((process, key) => {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        console.log(`Failed to kill process ${key}:`, error.message);
      }
    });
    runningProcesses.clear();
    workspaceProcesses.clear();
    
    res.json({ success: true, message: 'All processes killed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Kill process by port
app.post('/api/kill-port', (req, res) => {
  const { port } = req.body;
  
  if (!port) {
    return res.status(400).json({ success: false, message: 'Port number required' });
  }
  
  const { spawn } = require('child_process');
  const killProcess = spawn('lsof', ['-ti', `:${port}`]);
  
  let pids = '';
  killProcess.stdout.on('data', (data) => {
    pids += data.toString();
  });
  
  killProcess.on('close', (code) => {
    if (pids.trim()) {
      const pidList = pids.trim().split('\n');
      pidList.forEach(pid => {
        if (pid.trim()) {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (error) {
            console.log(`Failed to kill PID ${pid}:`, error.message);
          }
        }
      });
      res.json({ success: true, message: `Killed processes on port ${port}: ${pidList.join(', ')}` });
    } else {
      res.json({ success: true, message: `No processes found on port ${port}` });
    }
  });
  
  killProcess.on('error', (error) => {
    res.status(500).json({ success: false, message: `Error finding processes: ${error.message}` });
  });
});

// Find process by name
app.post('/api/find-process', (req, res) => {
  const { processName } = req.body;
  
  if (!processName) {
    return res.status(400).json({ success: false, message: 'Process name required' });
  }
  
  const { spawn } = require('child_process');
  const findProcess = spawn('ps', ['aux']);
  
  let output = '';
  findProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  findProcess.on('close', (code) => {
    const lines = output.split('\n');
    const processes = [];
    
    lines.forEach(line => {
      if (line.toLowerCase().includes(processName.toLowerCase()) && !line.includes('ps aux')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          processes.push({
            pid: parts[1],
            command: parts.slice(10).join(' ')
          });
        }
      }
    });
    
    res.json({ success: true, processes });
  });
  
  findProcess.on('error', (error) => {
    res.status(500).json({ success: false, message: `Error finding processes: ${error.message}` });
  });
});

// Copy script to project scripts folder
app.post('/api/copy-script', (req, res) => {
  const { sourcePath, scriptName } = req.body;
  
  if (!sourcePath || !scriptName) {
    return res.status(400).json({ success: false, message: 'Source path and script name required' });
  }
  
  try {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    
    const sourceFile = path.resolve(sourcePath);
    const targetFile = path.join(scriptsDir, scriptName);
    
    if (!fs.existsSync(sourceFile)) {
      return res.status(404).json({ success: false, message: 'Source file not found' });
    }
    
    fs.copyFileSync(sourceFile, targetFile);
    
    // Make executable if it's a script
    if (scriptName.endsWith('.sh') || scriptName.endsWith('.py') || scriptName.endsWith('.js') || scriptName.endsWith('.cjs')) {
      fs.chmodSync(targetFile, 0o755);
    }
    
    res.json({ 
      success: true, 
      message: 'Script copied successfully',
      targetPath: targetFile,
      relativePath: `./scripts/${scriptName}`
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Analyze script for parameters
app.post('/api/analyze-script', (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }
  
  let resolvedPath;
  try {
    if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      resolvedPath = path.resolve(process.cwd(), filePath);
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const fileExtension = path.extname(resolvedPath).toLowerCase();
    
    let scriptType = 'sh';
    if (fileExtension === '.py') scriptType = 'py';
    else if (fileExtension === '.cjs') scriptType = 'cjs';
    else if (fileExtension === '.js') scriptType = 'js';
    
    const parameters = analyzeScriptParameters(content, scriptType);
    
    // Analyze for interactive patterns
    const isInteractive = analyzeInteractivePatterns(content, scriptType);
    
    res.json({
      scriptType,
      parameters,
      filePath: resolvedPath,
      isInteractive,
      interactiveFeatures: isInteractive.features
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function analyzeInteractivePatterns(content, scriptType) {
  const features = [];
  let isInteractive = false;
  
  if (scriptType === 'sh') {
    // Check for interactive bash patterns
    const patterns = [
      { pattern: /read\s+-p\s+/, feature: 'read prompts' },
      { pattern: /read\s+-rsn1/, feature: 'single character input' },
      { pattern: /read\s+-r\s+/, feature: 'raw input' },
      { pattern: /select\s+\w+\s+in/, feature: 'select menus' },
      { pattern: /case\s+.*\s+in/, feature: 'case menus' },
      { pattern: /while\s+true.*read/, feature: 'interactive loops' },
      { pattern: /echo.*\[.*\]/, feature: 'menu options' },
      { pattern: /\$\{.*:-.*\}/, feature: 'default prompts' },
      { pattern: /tput\s+/, feature: 'terminal control' },
      { pattern: /printf\s+"\\033/, feature: 'ANSI escape sequences' },
      { pattern: /stty\s+/, feature: 'terminal settings' }
    ];
    
    patterns.forEach(({ pattern, feature }) => {
      if (pattern.test(content)) {
        features.push(feature);
        isInteractive = true;
      }
    });
    
    // Check for common interactive script keywords
    const interactiveKeywords = [
      'interactive', 'menu', 'prompt', 'workflow', 'wizard',
      'ticket', 'jira', 'selection', 'choose', 'input'
    ];
    
    const lowerContent = content.toLowerCase();
    interactiveKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        features.push(`keyword: ${keyword}`);
        isInteractive = true;
      }
    });
    
  } else if (scriptType === 'py') {
    // Check for interactive Python patterns
    const patterns = [
      { pattern: /input\s*\(/, feature: 'input prompts' },
      { pattern: /getpass\.getpass/, feature: 'password input' },
      { pattern: /click\.prompt/, feature: 'click prompts' },
      { pattern: /inquirer\./, feature: 'inquirer menus' },
      { pattern: /questionary\./, feature: 'questionary prompts' }
    ];
    
    patterns.forEach(({ pattern, feature }) => {
      if (pattern.test(content)) {
        features.push(feature);
        isInteractive = true;
      }
    });
  } else if (scriptType === 'js' || scriptType === 'cjs') {
    // Check for interactive Node.js patterns
    const patterns = [
      { pattern: /readline\./, feature: 'readline interface' },
      { pattern: /inquirer\./, feature: 'inquirer prompts' },
      { pattern: /prompt\s*\(/, feature: 'prompt function' },
      { pattern: /process\.stdin/, feature: 'stdin input' }
    ];
    
    patterns.forEach(({ pattern, feature }) => {
      if (pattern.test(content)) {
        features.push(feature);
        isInteractive = true;
      }
    });
  }
  
  return {
    isInteractive,
    features,
    confidence: features.length > 0 ? Math.min(features.length * 0.3, 1.0) : 0
  };
}

function analyzeScriptParameters(content, scriptType) {
  const parameters = [];
  
  if (scriptType === 'sh') {
    // Look for $1, $2, etc. and getopts patterns
    const positionalMatches = content.match(/\$[1-9]\d*/g) || [];
    const uniquePositional = [...new Set(positionalMatches)];
    
    uniquePositional.forEach(match => {
      const num = match.substring(1);
      parameters.push({
        name: `arg${num}`,
        type: 'text',
        description: `Positional argument ${num}`,
        defaultValue: '',
        required: true
      });
    });
    
    // Look for getopts patterns like "while getopts ":a:b:c" opt"
    const getoptsMatch = content.match(/getopts\s+["']([^"']+)["']/);
    if (getoptsMatch) {
      const optString = getoptsMatch[1];
      for (let i = 0; i < optString.length; i++) {
        const char = optString[i];
        if (char !== ':' && char.match(/[a-zA-Z]/)) {
          const hasValue = optString[i + 1] === ':';
          parameters.push({
            name: char,
            type: hasValue ? 'text' : 'checkbox',
            description: `Option -${char}${hasValue ? ' (requires value)' : ''}`,
            defaultValue: hasValue ? '' : false,
            required: false,
            flag: `-${char}`
          });
        }
      }
    }
  } else if (scriptType === 'py') {
    // Look for argparse patterns
    const argparseMatches = content.match(/add_argument\s*\(\s*['"]([^'"]+)['"]/g) || [];
    argparseMatches.forEach(match => {
      const argMatch = match.match(/['"]([^'"]+)['"]/);
      if (argMatch) {
        const argName = argMatch[1];
        const cleanName = argName.replace(/^--?/, '');
        parameters.push({
          name: cleanName,
          type: 'text',
          description: `Argument ${argName}`,
          defaultValue: '',
          required: !argName.startsWith('--'),
          flag: argName
        });
      }
    });
    
    // Look for sys.argv usage
    const sysArgvMatches = content.match(/sys\.argv\[(\d+)\]/g) || [];
    sysArgvMatches.forEach(match => {
      const indexMatch = match.match(/\[(\d+)\]/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1]);
        if (index > 0) { // sys.argv[0] is script name
          parameters.push({
            name: `arg${index}`,
            type: 'text',
            description: `Command line argument ${index}`,
            defaultValue: '',
            required: true
          });
        }
      }
    });
  } else if (scriptType === 'js' || scriptType === 'cjs') {
    // Look for process.argv usage
    const processArgvMatches = content.match(/process\.argv\[(\d+)\]/g) || [];
    processArgvMatches.forEach(match => {
      const indexMatch = match.match(/\[(\d+)\]/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1]);
        if (index >= 2) { // process.argv[0] is node, [1] is script
          const argIndex = index - 1; // Convert to 1-based for user display
          parameters.push({
            name: `arg${argIndex}`,
            type: 'text',
            description: `Command line argument ${argIndex}`,
            defaultValue: '',
            required: true
          });
        }
      }
    });
    
    // Look for commander.js or yargs patterns
    const commanderMatches = content.match(/\.option\s*\(\s*['"]([^'"]+)['"]/g) || [];
    commanderMatches.forEach(match => {
      const optMatch = match.match(/['"]([^'"]+)['"]/);
      if (optMatch) {
        const optName = optMatch[1];
        const cleanName = optName.replace(/^--?/, '').split(',')[0].trim();
        parameters.push({
          name: cleanName,
          type: 'text',
          description: `Option ${optName}`,
          defaultValue: '',
          required: false,
          flag: optName
        });
      }
    });
  }
  
  // Remove duplicates based on name
  const uniqueParams = parameters.filter((param, index, self) => 
    index === self.findIndex(p => p.name === param.name)
  );
  
  return uniqueParams;
}

app.post('/api/import', (req, res) => {
  try {
    const importData = req.body;
    
    // Validate import data structure
    if (!importData.workspaces || !Array.isArray(importData.workspaces)) {
      return res.status(400).json({ success: false, message: 'Invalid import data format' });
    }
    
    const success = saveWorkspacesToFile(importData.workspaces);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Imported ${importData.workspaces.length} workspaces successfully`,
        count: importData.workspaces.length
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to import workspaces' });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: 'Import failed: ' + error.message });
  }
});

// Run script endpoint
app.post('/api/script/run', (req, res) => {
  const { workspaceId, scriptId, script } = req.body;
  const processKey = `${workspaceId}-${scriptId}`;
  
  // Load current settings
  const settings = loadSettings();
  
  // Kill existing process if running
  if (runningProcesses.has(processKey)) {
    const existingProcess = runningProcesses.get(processKey);
    existingProcess.kill('SIGTERM');
    runningProcesses.delete(processKey);
  }
  
  // Resolve script path
  let scriptPath;
  if (path.isAbsolute(script.filePath)) {
    scriptPath = script.filePath;
  } else {
    scriptPath = path.resolve(process.cwd(), script.filePath);
  }
  
  // Determine command and args based on script type
  let command, args;
  
  // Parse script parameters if provided
  const scriptParams = script.parameters ? script.parameters.trim().split(/\s+/) : [];
  
  if (script.type === 'py') {
    command = settings.pythonPath || 'python3';
    args = [scriptPath, ...scriptParams];
  } else if (script.type === 'cjs' || script.type === 'js') {
    command = settings.nodePath || 'node';
    args = [scriptPath, ...scriptParams];
  } else {
    command = 'bash';
    args = [scriptPath, ...scriptParams];
  }
  
  // Check if file exists
  if (!fs.existsSync(scriptPath)) {
    const errorMsg = `Error: Script file not found: ${scriptPath}\n` +
                    `Original path: ${script.filePath}\n` +
                    `Resolved path: ${scriptPath}\n` +
                    `Current working directory: ${process.cwd()}\n` +
                    `Please check the file path and ensure the file exists.\n`;
    
    broadcastLog(workspaceId, scriptId, errorMsg);
    return res.status(400).json({ 
      error: 'Script file not found',
      originalPath: script.filePath,
      resolvedPath: scriptPath,
      cwd: process.cwd()
    });
  }
  
  // Check if file is executable (for shell scripts)
  if (script.type === 'sh') {
    try {
      fs.accessSync(scriptPath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      const errorMsg = `Error: Script file is not readable: ${scriptPath}\n` +
                      `Try running: chmod +x ${scriptPath}\n`;
      broadcastLog(workspaceId, scriptId, errorMsg);
      return res.status(400).json({ 
        error: 'Script file is not readable',
        suggestion: `chmod +x ${scriptPath}`
      });
    }
  }
  
  // Spawn process
  const childProcess = spawn(command, args, {
    cwd: path.dirname(scriptPath),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  runningProcesses.set(processKey, childProcess);
  
  // Track workspace processes
  if (!workspaceProcesses.has(workspaceId)) {
    workspaceProcesses.set(workspaceId, new Set());
  }
  workspaceProcesses.get(workspaceId).add(processKey);
  
  broadcastStatus(workspaceId, scriptId, true);
  broadcastLog(workspaceId, scriptId, `Starting ${script.type} script: ${script.name}\n`);
  broadcastLog(workspaceId, scriptId, `Script path: ${scriptPath}\n`);
  broadcastLog(workspaceId, scriptId, `Command: ${command} ${args.join(' ')}\n`);
  broadcastLog(workspaceId, scriptId, `Working directory: ${path.dirname(scriptPath)}\n\n`);
  
  // Handle stdout
  childProcess.stdout.on('data', (data) => {
    broadcastLog(workspaceId, scriptId, data.toString());
  });
  
  // Handle stderr
  childProcess.stderr.on('data', (data) => {
    broadcastLog(workspaceId, scriptId, `ERROR: ${data.toString()}`);
  });
  
  // Handle process exit
  childProcess.on('close', (code, signal) => {
    runningProcesses.delete(processKey);
    if (workspaceProcesses.has(workspaceId)) {
      workspaceProcesses.get(workspaceId).delete(processKey);
    }
    
    broadcastStatus(workspaceId, scriptId, false);
    
    if (signal) {
      broadcastLog(workspaceId, scriptId, `\nProcess terminated with signal: ${signal}\n`);
    } else {
      broadcastLog(workspaceId, scriptId, `\nProcess exited with code: ${code}\n`);
    }
  });
  
  // Handle process error
  childProcess.on('error', (error) => {
    runningProcesses.delete(processKey);
    if (workspaceProcesses.has(workspaceId)) {
      workspaceProcesses.get(workspaceId).delete(processKey);
    }
    
    broadcastStatus(workspaceId, scriptId, false);
    broadcastLog(workspaceId, scriptId, `\nProcess error: ${error.message}\n`);
    
    // Provide helpful suggestions based on the error
    if (error.code === 'ENOENT') {
      if (script.type === 'py') {
        broadcastLog(workspaceId, scriptId, `Suggestion: Make sure Python is installed and available as '${settings.pythonPath || 'python3'}'\n`);
        broadcastLog(workspaceId, scriptId, `You can configure the Python path in settings if needed.\n`);
      } else if (script.type === 'cjs' || script.type === 'js') {
        broadcastLog(workspaceId, scriptId, `Suggestion: Make sure Node.js is installed and available as '${settings.nodePath || 'node'}'\n`);
        broadcastLog(workspaceId, scriptId, `You can configure the Node.js path in settings if needed.\n`);
      } else {
        broadcastLog(workspaceId, scriptId, `Suggestion: Make sure bash is available in your PATH\n`);
      }
    }
  });
  
  res.json({ success: true, message: 'Script started', scriptPath });
});

// Stop script endpoint
app.post('/api/script/stop', (req, res) => {
  const { workspaceId, scriptId } = req.body;
  const processKey = `${workspaceId}-${scriptId}`;
  
  if (runningProcesses.has(processKey)) {
    const process = runningProcesses.get(processKey);
    process.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (runningProcesses.has(processKey)) {
        process.kill('SIGKILL');
      }
    }, 5000);
    
    res.json({ success: true, message: 'Script stopped' });
  } else {
    res.status(404).json({ error: 'Process not found' });
  }
});

// Kill all processes endpoint
app.post('/api/kill-all', (req, res) => {
  let killedCount = 0;
  
  runningProcesses.forEach((process, key) => {
    process.kill('SIGTERM');
    killedCount++;
  });
  
  // Force kill after 5 seconds
  setTimeout(() => {
    runningProcesses.forEach((process, key) => {
      if (runningProcesses.has(key)) {
        process.kill('SIGKILL');
      }
    });
    runningProcesses.clear();
    workspaceProcesses.clear();
  }, 5000);
  
  res.json({ success: true, message: `Killed ${killedCount} processes` });
});

// Kill all workspace processes endpoint
app.post('/api/workspace/:workspaceId/kill-all', (req, res) => {
  const { workspaceId } = req.params;
  let killedCount = 0;
  
  if (workspaceProcesses.has(workspaceId)) {
    const processKeys = Array.from(workspaceProcesses.get(workspaceId));
    
    processKeys.forEach(processKey => {
      if (runningProcesses.has(processKey)) {
        const process = runningProcesses.get(processKey);
        process.kill('SIGTERM');
        killedCount++;
      }
    });
    
    // Force kill after 5 seconds
    setTimeout(() => {
      processKeys.forEach(processKey => {
        if (runningProcesses.has(processKey)) {
          const process = runningProcesses.get(processKey);
          process.kill('SIGKILL');
          runningProcesses.delete(processKey);
        }
      });
      workspaceProcesses.delete(workspaceId);
    }, 5000);
  }
  
  res.json({ success: true, message: `Killed ${killedCount} workspace processes` });
});

// Open path endpoint (for Cmd+click links in terminal)
app.post('/api/open-path', (req, res) => {
  const { path: filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ success: false, message: 'No path provided' });
  }
  
  try {
    const { spawn } = require('child_process');
    let command, args;
    
    // Determine the appropriate command based on the platform
    if (process.platform === 'darwin') {
      // macOS - use 'open' command
      command = 'open';
      args = [filePath];
    } else if (process.platform === 'win32') {
      // Windows - use 'start' command
      command = 'start';
      args = ['', filePath]; // Empty string is required for start command
    } else {
      // Linux - use 'xdg-open' command
      command = 'xdg-open';
      args = [filePath];
    }
    
    const openProcess = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    openProcess.unref(); // Allow the parent process to exit independently
    
    res.json({ 
      success: true, 
      message: `Opened ${filePath}`,
      command: `${command} ${args.join(' ')}`
    });
    
  } catch (error) {
    console.error('Error opening path:', error);
    res.status(500).json({ 
      success: false, 
      message: `Failed to open path: ${error.message}` 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const workspaces = loadWorkspacesFromFile();
  const settings = loadSettings();
  res.json({ 
    status: 'ok', 
    runningProcesses: runningProcesses.size,
    activeConnections: Array.from(scriptConnections.keys()).length,
    configFile: WORKSPACES_FILE,
    settingsFile: SETTINGS_FILE,
    workspacesCount: workspaces.length,
    settings: settings
  });
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Kill all running processes
  runningProcesses.forEach((process) => {
    if (process && !process.killed) {
      process.kill();
    }
  });
  
  // Close all terminal connections
  terminalConnections.forEach((terminal) => {
    if (terminal.ws && terminal.ws.readyState === WebSocket.OPEN) {
      terminal.ws.close();
    }
  });
  
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});