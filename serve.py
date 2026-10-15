# Локальный сервер для разработки: как `python -m http.server`, но без кэша,
# чтобы браузер не смешивал старые и новые версии модулей.
#   python serve.py            -> http://localhost:8123/
#   python serve.py 8000 0.0.0.0  -> доступно с телефона в той же Wi-Fi сети
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
host = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
print(f'http://{"localhost" if host == "127.0.0.1" else host}:{port}/')
ThreadingHTTPServer((host, port), handler).serve_forever()
