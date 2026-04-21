# Workspace Script Manager

A React web application for managing workspaces with script execution capabilities. Each workspace can contain multiple shell (.sh) or Python (.py) scripts that can be executed with real-time log viewing.

## Features

- **Workspace Management**: Create, edit, and delete workspaces
- **Script Management**: Add shell and Python scripts to workspaces
- **Real-time Execution**: Run scripts with live log output via WebSocket
- **Process Control**: Start, stop, and kill individual scripts or all scripts
- **Persistent Storage**: Workspace configurations are saved in JSON files on disk
- **Export/Import**: Backup and restore workspace configurations
- **File Selection**: Browse and select script files from your system

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Python 3 (for Python scripts)
- Bash shell (for shell scripts)

### Installation

#### Option 1: Quick Start (Recommended)

1. **Linux/macOS:**
```bash
./run.sh
```

2. **Windows:**
```batch
run.bat
```

3. **Cross-platform (using npm):**
```bash
npm install
npm run dev
```

#### Option 2: Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start the backend server:
```bash
npm run server
```

3. In a new terminal, start the React development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

### Run Scripts

The project includes several run scripts for convenience:

- **`run.sh`** - Full-featured bash script with dependency checking and process management
- **`run.bat`** - Windows batch file equivalent
- **`run-simple.sh`** - Simple script using npm concurrently
- **`npm run dev`** - Uses concurrently to run both servers simultaneously

## Usage

### Creating a Workspace

1. Click "Create Workspace" button
2. Enter workspace name and description
3. Click "Create"

### Adding Scripts

1. Select a workspace from the list
2. Click "Add Script" button
3. Select a script file (.sh or .py)
4. Fill in script details:
   - Name: Display name for the script
   - Description: Optional description
   - Custom Button Label: Optional custom text for the run button
5. Click "Add Script"

### Running Scripts

1. In a workspace, find the script you want to run
2. Click the run button (default "Run" or your custom label)
3. Click "Show Logs" to view real-time output
4. Use "Stop" to terminate the script
5. Use "Clear" to clear the log output

### Managing Scripts

- **Edit**: Modify script name, description, and button label
- **Delete**: Remove script from workspace
- **Kill All Scripts**: Stop all running scripts in the workspace
- **Kill All**: Stop all running scripts across all workspaces

### Workspace Persistence

- Workspace configurations are automatically saved to `config/workspaces.json`
- Scripts and settings persist between application restarts
- Export configurations to backup or share with team members
- Import configurations to restore or sync across machines
- Running processes are managed by the backend server

## API Endpoints

The backend server provides the following endpoints:

- `POST /api/workspaces` - Save workspace configurations
- `GET /api/workspaces` - Load workspace configurations
- `GET /api/export` - Export workspace configurations as JSON
- `POST /api/import` - Import workspace configurations from JSON
- `POST /api/script/run` - Start a script
- `POST /api/script/stop` - Stop a script
- `POST /api/kill-all` - Kill all running processes
- `POST /api/workspace/:id/kill-all` - Kill all processes in a workspace
- `GET /api/health` - Server health check
- `WebSocket /ws/:workspaceId/:scriptId` - Real-time logs and status

## File Structure

```
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── WorkspaceList.js
│   │   ├── WorkspaceDetail.js
│   │   ├── ScriptItem.js
│   │   ├── CreateWorkspaceModal.js
│   │   ├── AddScriptModal.js
│   │   └── EditScriptModal.js
│   ├── utils/
│   │   └── storage.js
│   ├── App.js
│   ├── index.js
│   └── index.css
├── server/
│   └── index.js
├── package.json
└── README.md
```

## Configuration Storage

Workspace configurations are now stored in JSON files instead of browser localStorage:

- **Location**: `config/workspaces.json` (created automatically)
- **Format**: JSON with workspace metadata and script configurations
- **Backup**: Use Export/Import buttons to backup and restore configurations
- **Sharing**: Export configurations to share workspace setups with team members
- **Version Control**: The `config/` directory is gitignored by default

### Export/Import

- **Export**: Downloads a `workspace-config-YYYY-MM-DD.json` file with all configurations
- **Import**: Upload a previously exported JSON file to restore configurations
- **Merge**: Import will replace all existing workspaces with imported ones

## Technical Details
- **Backend**: Express.js with WebSocket support
- **Process Management**: Node.js child_process for script execution
- **Real-time Communication**: WebSocket for live logs and status updates
- **Storage**: Browser localStorage for workspace persistence
- **Styling**: CSS with responsive design

## Troubleshooting

### Scripts not running
- Ensure script files have proper permissions (`chmod +x script.sh`)
- Verify Python 3 is installed for Python scripts
- Check that file paths are correct and accessible

### WebSocket connection issues
- Ensure backend server is running on port 3001
- Check browser console for connection errors
- Verify firewall settings allow WebSocket connections

### Process management
- Use "Kill All" if processes become unresponsive
- Check server logs for process execution errors
- Restart the backend server if needed

## Development

To extend the application:

1. **Add new script types**: Modify the script execution logic in `server/index.js`
2. **Enhance UI**: Update components in `src/components/`
3. **Add features**: Extend the API endpoints and React components
4. **Improve storage**: Replace localStorage with a database for production use