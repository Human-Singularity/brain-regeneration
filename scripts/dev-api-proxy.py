#!/usr/bin/env python3
"""Dev-only proxy for the GregoryAi API.

The API only sends Access-Control-Allow-Origin for https://brain-regeneration.com,
so client-side feeds can't load real data from a localhost dev server. This
forwards to the live API and adds a permissive CORS header, for local use only.

    python3 scripts/dev-api-proxy.py            # listens on 127.0.0.1:8000
"""
import sys, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

UPSTREAM = "https://api.brain-regeneration.com"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Proxy(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        url = UPSTREAM + self.path
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body, status = r.read(), r.status
                ctype = r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            body, status, ctype = e.read(), e.code, "application/json"
        except Exception as e:
            body, status, ctype = str(e).encode(), 502, "text/plain"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("  proxy %s\n" % (fmt % args))


class Server(HTTPServer):
    # Lets the port be rebound immediately after a restart, rather than waiting
    # out TIME_WAIT from the previous run.
    allow_reuse_address = True


print("Proxying %s -> http://127.0.0.1:%d" % (UPSTREAM, PORT))
Server(("127.0.0.1", PORT), Proxy).serve_forever()
