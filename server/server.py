import sys
import urllib.parse
import os
import hashlib

from http.server import HTTPServer, BaseHTTPRequestHandler

port = 1342
address = "localhost"

for i in range(2, len(sys.argv)):
    if sys.argv[i] == "--port": 
         port = int(sys.argv[i+1])
    elif sys.argv[i] == "--address":
         address = sys.argv[i+1]

class ServerRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): # Disable any kind of logging of server requests
        pass
    def do_OPTIONS(self): # Setup CORS
            self.send_response(200)
            self.send_header("Allow", "PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
    def do_GET(self):
         self.send_response(200)
         self.end_headers()
         self.wfile.write(bytes("Server running", "utf-8"))
    def do_PUT(self): 
        url_type = urllib.parse.urlparse(f"http://localhost{self.path}")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if url_type.path == "/upload/": 
            query = urllib.parse.parse_qs(url_type.query)
            if "filename" in query and "position" in query:
                print(f"Writing to file: {query.get('filename')[0]}" )
                path = f"{sys.argv[1]}{os.path.sep}{query.get('filename')[0]}"
                with open(path, "r+b" if os.path.isfile(path) else "x+b") as file_to_write:
                    file_to_write.seek(int(query.get("position")[0])) # Let's write to the position sent by the client
                    bytes_remaining = int(self.headers.get("Content-Length", 0)) # We'll enforce the Content-Length sent by the client
                    while bytes_remaining > 0:
                        chunk_size_to_read = min(8192, bytes_remaining)
                        chunk = self.rfile.read(chunk_size_to_read)
                        if not chunk: break
                        file_to_write.write(chunk)
                        bytes_remaining -= len(chunk)
        self.end_headers()
    
server = HTTPServer((address, port), ServerRequestHandler)
print(f"---- Starting server ----\nAddress:     {address}\nPort:        {port}\nFolder:      {sys.argv[1]}")
server.serve_forever()