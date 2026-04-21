#!/usr/bin/env python3

import http.server
import socketserver
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'''
            <html>
            <head><title>Test Web Server</title></head>
            <body>
                <h1>Hello from Python Web Server!</h1>
                <p>This is a simple test server running on port 8000</p>
                <p>Current directory: ''' + os.getcwd().encode() + b'''</p>
            </body>
            </html>
            ''')
        else:
            super().do_GET()

print(f"Starting web server on port {PORT}")
print(f"Visit http://localhost:{PORT} to see the server")

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()