# Web Terminal Emulator

A modern web-based terminal emulator built with React (TypeScript) frontend and FastAPI (Python) backend. This project provides a full-featured terminal interface in the browser, complete with PTY (pseudo-terminal) support for running real shell commands.

## Features

- 🖥️ **Full Terminal Emulation**: Real bash/shell access via WebSocket
- 🎨 **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- 🔄 **Real-time Communication**: WebSocket-based bidirectional communication
- 📏 **Dynamic Resizing**: Terminal automatically resizes with window
- 🎯 **Session Management**: Multiple terminal sessions support
- 🔍 **Search**: Built-in terminal search functionality
- 🔗 **Clickable Links**: Automatic link detection and clicking
- 🚀 **Fast Performance**: Optimized for responsive terminal experience

## Project Structure

```
afterquery/
├── frontend/                    # React TypeScript frontend
│   └── src/
│       └── components/
│           └── terminal/
│               └── terminal.tsx # Main terminal component
├── backend/                     # FastAPI Python backend
│   ├── main.py                 # Main FastAPI application
│   ├── start_server.py         # Server startup script
│   └── test_terminal.py        # Backend testing script
└── README.md                   # This file
```

## Prerequisites

### Backend Requirements
- Python 3.8+
- pip (Python package manager)

### Frontend Requirements
- Node.js 16+
- npm or yarn

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd afterquery/backend
```

2. Install Python dependencies:
```bash
pip install fastapi uvicorn websockets
```

3. Start the backend server:
```bash
python start_server.py
```

The backend will start on `http://127.0.0.1:8000` by default.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd afterquery/frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will typically start on `http://localhost:3000`.

## Usage

### Basic Usage

1. Start the backend server (see Backend Setup above)
2. Start the frontend development server
3. Open your browser to the frontend URL
4. The terminal will automatically connect to the backend
5. Start typing commands!

### Terminal Features

- **Command Execution**: Type any shell command and press Enter
- **Terminal Resizing**: The terminal automatically adjusts to window size
- **Search**: Use Ctrl+F to search within the terminal
- **Copy/Paste**: Standard browser copy/paste shortcuts work
- **Clickable Links**: URLs in terminal output are automatically clickable

### Example Commands

```bash
# Basic commands
ls -la
pwd
whoami
date

# Interactive commands
top
nano filename.txt
vim filename.txt

# System information
uname -a
df -h
free -h
```

## API Documentation

### WebSocket Endpoints

#### Terminal Session
- **URL**: `ws://127.0.0.1:8000/ws/shell/{session_id}`
- **Purpose**: Establish a terminal session
- **Parameters**: 
  - `session_id`: Unique identifier for the terminal session

#### Message Types

**Input Messages** (Client → Server):
- **Text Commands**: Raw text sent to the shell
- **Resize Commands**: JSON format for terminal resizing
  ```json
  {
    "type": "resize",
    "rows": 30,
    "cols": 120
  }
  ```

**Output Messages** (Server → Client):
- **Terminal Output**: Binary data containing terminal output
- **Status Messages**: Connection status and error messages

### HTTP Endpoints

#### Health Check
- **URL**: `GET /health`
- **Response**: 
  ```json
  {
    "status": "healthy",
    "active_sessions": 1
  }
  ```

## Testing

### Backend Testing

Run the backend test script to verify functionality:

```bash
cd afterquery/backend
python test_terminal.py
```

This will test:
- WebSocket connection
- Command execution
- Terminal resizing
- Interactive commands

### Manual Testing

1. Start the backend server
2. Open multiple browser tabs/windows
3. Verify each gets its own terminal session
4. Test various commands and interactions

## Configuration

### Backend Configuration

Environment variables can be used to configure the backend:

```bash
# Server configuration
export HOST=127.0.0.1      # Server host
export PORT=8000           # Server port
export RELOAD=true         # Auto-reload on changes
export LOG_LEVEL=info      # Logging level
```

### Frontend Configuration

The frontend automatically connects to the backend. To change the connection:

1. Edit `afterquery/frontend/src/components/terminal/terminal.tsx`
2. Modify the `wsUrl` in the `useMemo` hook
3. Update the URL to match your backend configuration

## Troubleshooting

### Common Issues

#### Backend Won't Start
- **Check Python version**: Ensure Python 3.8+ is installed
- **Install dependencies**: Run `pip install fastapi uvicorn websockets`
- **Port conflicts**: Change the port in `start_server.py` if 8000 is in use

#### Frontend Won't Connect
- **Backend running**: Ensure the backend is running on the expected port
- **CORS issues**: The backend is configured to allow all origins
- **WebSocket URL**: Verify the WebSocket URL in the frontend code

#### Terminal Not Responding
- **Check browser console**: Look for WebSocket connection errors
- **Network issues**: Verify network connectivity between frontend and backend
- **Session conflicts**: Try refreshing the page to get a new session

#### Commands Not Working
- **PTY issues**: Ensure the backend has permission to create PTY sessions
- **Shell availability**: Verify bash is available on the system
- **File permissions**: Check if the backend process has necessary permissions

### Debug Mode

Enable debug logging in the backend:

```bash
export LOG_LEVEL=debug
python start_server.py
```

This will provide detailed logs of WebSocket messages and PTY operations.

## Security Considerations

⚠️ **Important Security Notes**:

- This terminal emulator provides **full shell access** to the server
- Only use this in trusted environments
- Consider implementing authentication for production use
- The current configuration allows all CORS origins
- Run the backend with minimal privileges when possible

## Development

### Backend Development

The backend uses:
- **FastAPI**: Modern Python web framework
- **WebSockets**: Real-time bidirectional communication
- **PTY**: Pseudo-terminal for shell access
- **asyncio**: Asynchronous programming

### Frontend Development

The frontend uses:
- **React**: Component-based UI framework
- **TypeScript**: Type-safe JavaScript
- **xterm.js**: Terminal emulator library
- **Tailwind CSS**: Utility-first CSS framework

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is provided as-is for educational and development purposes.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Check the backend logs for server-side issues
4. Test with the provided test script

---

**Happy Terminal Emulating!** 🚀