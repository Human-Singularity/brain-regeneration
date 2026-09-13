#!/usr/bin/env python3
"""Dev-only proxy for the GregoryAi API.

The API only sends Access-Control-Allow-Origin for https://brain-regeneration.com,
so client-side feeds can't load real data from a localhost dev server. This
forwards to the live API and adds a permissive CORS header, for local use only.

    python3 scripts/dev-api-proxy.py            # listens on 127.0.0.1:8000

Handles POST as well as GET, so the subscribe forms can be exercised too, and
deliberately does not follow redirects: subscribe.js posts with
`redirect: 'manual'` and treats an opaque redirect as success, so the redirect
has to reach the browser rather than being resolved here.
"""
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

UPSTREAM = "https://api.brain-regeneration.com"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
MAX_BODY = 2 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)


class Proxy(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self._forward()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            self.send_error(413, "Request body too large for the dev proxy")
            return
        self._forward(self.rfile.read(length) if length else b"")

    def _forward(self, body=None):
        headers = {"Accept": self.headers.get("Accept", "application/json")}
        if body is not None:
            headers["Content-Type"] = self.headers.get(
                "Content-Type", "application/x-www-form-urlencoded"
            )
        req = urllib.request.Request(UPSTREAM + self.path, data=body, headers=headers)
        location = None
        try:
            with opener.open(req, timeout=30) as r:
                payload, status = r.read(), r.status
                ctype = r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            # Includes the 3xx that NoRedirect declines to follow — pass the
            # status and Location straight through to the caller.
            payload, status = e.read(), e.code
            ctype = e.headers.get("Content-Type", "application/json")
            location = e.headers.get("Location")
        except Exception as e:
            payload, status, ctype = str(e).encode(), 502, "text/plain"

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        if location:
            self.send_header("Location", location)
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        sys.stderr.write("  proxy %s\n" % (fmt % args))


class Server(HTTPServer):
    # Lets the port be rebound immediately after a restart, rather than waiting
    # out TIME_WAIT from the previous run.
    allow_reuse_address = True


print("Proxying http://127.0.0.1:%d -> %s" % (PORT, UPSTREAM), flush=True)
Server(("127.0.0.1", PORT), Proxy).serve_forever()
