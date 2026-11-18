#!/usr/bin/env python3
"""Exercise deployment rate limits using isolated nginx and a dummy backend."""
import concurrent.futures
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

class Backend(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/hold':
            time.sleep(.4)
        upstream_limited = self.path == '/upstream-rate-limit'
        self.send_response(429 if upstream_limited else 200)
        if upstream_limited:
            self.send_header('Retry-After', '900')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"test":true}')
    def log_message(self, *args):
        pass

class TestServer(ThreadingHTTPServer):
    request_queue_size = 64

backend = TestServer(('127.0.0.1', 0), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
try:
    for phase in ['login', 'api', 'connections']:
        with tempfile.TemporaryDirectory(prefix='futter-nginx-test-') as directory:
            temp = Path(directory)
            with socket.socket() as reserve:
                reserve.bind(('127.0.0.1', 0))
                port = reserve.getsockname()[1]
            site = (ROOT / 'deploy/nginx-https.conf').read_text()
            site = re.sub(r'listen 169\.58\.211\.254:443 ssl;', f'listen 127.0.0.1:{port};', site)
            site = re.sub(r'^\s*ssl_.*;\s*$', '', site, flags=re.MULTILINE)
            site = site.replace('http://127.0.0.1:8788/', f'http://127.0.0.1:{backend.server_port}/')
            config = temp / 'nginx.conf'
            config.write_text(f'pid {temp}/nginx.pid;\nerror_log {temp}/error.log warn;\nevents {{ worker_connections 128; }}\nhttp {{\naccess_log off;\nclient_body_temp_path {temp}/body;\nproxy_temp_path {temp}/proxy;\n' + (ROOT / 'deploy/nginx-limits.conf').read_text() + site + '\n}\n')
            subprocess.run(['/usr/sbin/nginx', '-t', '-p', directory, '-c', str(config)], check=True, capture_output=True)
            process = subprocess.Popen(['/usr/sbin/nginx', '-p', directory, '-c', str(config), '-g', 'daemon off; master_process off;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        raise RuntimeError((temp / 'error.log').read_text())
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=.1):
                            break
                    except OSError:
                        time.sleep(.02)
                else:
                    raise RuntimeError('test nginx failed to listen')
                def request(path):
                    try:
                        response = urllib.request.urlopen(f'http://127.0.0.1:{port}' + path, timeout=5)
                    except urllib.error.HTTPError as error:
                        response = error
                    return response.code, response.headers, json.loads(response.read())
                upstream = request('/futter/upstream-rate-limit')
                assert upstream[0] == 429 and upstream[1]['Retry-After'] == '900'
                if phase == 'login':
                    paths = ['/futter/api/login', '/futter/api/LOGIN', '/futter/api/login/'] * 4
                    results = [request(path) for path in paths]
                elif phase == 'connections':
                    with concurrent.futures.ThreadPoolExecutor(max_workers=28) as pool:
                        results = list(pool.map(request, ['/futter/hold'] * 28))
                else:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
                        results = list(pool.map(request, ['/futter/api/session'] * 50))
                assert any(code == 200 for code, _, _ in results), results
                assert any(code == 429 for code, _, _ in results), results
                for code, headers, body in results:
                    assert code in (200, 429), code
                    if code == 429:
                        assert headers['Retry-After'] == '10'
                        assert headers['Cache-Control'] == 'no-store'
                        assert 'error' in body
                log = (temp / 'error.log').read_text()
                assert ('limiting connections' if phase == 'connections' else 'limiting requests') in log
                print(f'PASS: isolated nginx {phase} limit, normal requests, JSON 429 and Retry-After.')
            finally:
                process.terminate()
                process.wait(timeout=5)
finally:
    backend.shutdown()
    backend.server_close()
