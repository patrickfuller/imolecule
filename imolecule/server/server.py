"""
Creates an HTTP server with websocket communication.
"""
import argparse
import json
import logging
import multiprocessing
import os
import sys
import traceback
import webbrowser

import tornado.web
import tornado.websocket

# Load supported open babel formats for save as options
PATH = os.path.dirname(os.path.realpath(__file__))
with open(os.path.join(PATH, 'data/openbabel_formats.json')) as in_file:
    OB_FORMATS = json.load(in_file)

args = None


def _worker_process(msg):
    """Wrapper function for worker process to execute."""
    from imolecule import format_converter
    return getattr(format_converter, msg['method'])(**msg['params'])


class IndexHandler(tornado.web.RequestHandler):

    def get(self):
        self.render('server.template', port=args.port, formats=OB_FORMATS)


class WebSocket(tornado.websocket.WebSocketHandler):
    pool = None

    def on_message(self, message):
        """Evaluates the function pointed to by json-rpc."""
        json_rpc = json.loads(message)
        logging.log(logging.DEBUG, json_rpc)

        if self.pool is None:
            self.pool = multiprocessing.Pool(processes=args.workers)

        # Spawn a process to protect the server against segfaults
        async = self.pool.apply_async(_worker_process, [json_rpc])
        try:
            result = async.get(timeout=args.timeout)
            error = 0
        except multiprocessing.TimeoutError:
            result = ("File format conversion timed out! This is due "
                      "either to a large input file or a segmentation "
                      "fault in the underlying open babel library.")
            error = 1
            self.pool.terminate()
            self.pool = multiprocessing.Pool(processes=args.workers)
        except Exception:
            result = traceback.format_exc()
            error = 1
        logging.log(logging.DEBUG, result)

        self.write_message(json.dumps({'result': result, 'error': error,
                                       'id': json_rpc['id']},
                                      separators=(',', ':')))


def start_server():
    """Starts up the imolecule server, complete with argparse handling."""
    parser = argparse.ArgumentParser(description="Opens a browser-based "
                                     "client that interfaces with the "
                                     "chemical format converter.")
    parser.add_argument('--debug', action="store_true", help="Prints all "
                        "transmitted data streams.")
    parser.add_argument('--port', type=int, default=8000, help="The port "
                        "on which to serve the website.")
    parser.add_argument('--timeout', type=int, default=5, help="The maximum "
                        "time, in seconds, allowed for a process to run "
                        "before returning an error.")
    parser.add_argument('--workers', type=int, default=2, help="The number of "
                        "worker processes to use with the server.")
    parser.add_argument('--no-browser', action="store_true", help="Disables "
                        "opening a browser window on startup.")
    global args
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    handlers = [(r'/', IndexHandler), (r'/websocket', WebSocket),
                (r'/static/(.*)', tornado.web.StaticFileHandler,
                 {'path': os.path.normpath(os.path.dirname(__file__))})]
    application = tornado.web.Application(handlers)
    application.listen(args.port)

    if not args.no_browser:
        webbrowser.open('http://localhost:%d/' % args.port, new=2)

    try:
        tornado.ioloop.IOLoop.instance().start()
    except KeyboardInterrupt:
        sys.stderr.write("Received keyboard interrupt. Stopping server.\n")
        tornado.ioloop.IOLoop.instance().stop()
        sys.exit(1)


if __name__ == '__main__':
    start_server()
