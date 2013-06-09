"""
A server to communicate with the javascript-based viewer.

Currently implements zeroMQ sockets server side, which are mapped to javascript
websockets wrapped with SocketIO using tornado.
    * zeroMQ - A wrapper around sockets that handles a lot of messiness
               involved with network connections
    * socketIO - A wrapper around javascript websockets that handles the
                 differences in implementations across browser/OS combinations
    * tornado - A Python-based web framework that allows us to convert easily
                between the zeroMQ and socketIO wrappers.
It sounds complicated to use all of these libraries, but it makes this approach
more robust and surprisingly easier.
"""
import os

import logging
import traceback

import zmq
from zmq.eventloop import ioloop, zmqstream
ioloop.install()

import faulthandler
faulthandler.enable()

import tornado
import tornado.web
import tornadio
import tornadio.router
import tornadio.server

import format_converter
from config import HTTP_PORT, TCP_PORT

ROOT = os.path.normpath(os.path.dirname(__file__))
with open("index.html") as index_file:
    index = index_file.read() % {"port": HTTP_PORT}


class IndexHandler(tornado.web.RequestHandler):

    def get(self):
        self.write(index)


class ClientConnection(tornadio.SocketConnection):

    def on_message(self, message):
        """Evaluates the function pointed to by json-rpc."""
        logging.log(logging.DEBUG, message)
        error = None

        try:
            # The only available method is `convert`, but I'm generalizing
            # to allow other methods without too much extra code
            result = getattr(format_converter,
                             message["method"])(**message["params"])
        except:
            result = traceback.format_exc()
            error = 1
        logging.log(logging.DEBUG, result)
        self.send({"result": result, "error": error, "id": message["id"]})


WebClientRouter = tornadio.get_router(ClientConnection)

handler = [(r"/", IndexHandler), WebClientRouter.route()]
kwargs = {"enabled_protocols": ["websocket", "flashsocket",
                                "xhr-multipart", "xhr-polling"],
          "flash_policy_port": 843,
          "flash_policy_file": os.path.join(ROOT, "flashpolicy.xml"),
          "static_path": os.path.join(ROOT, "static"),
          "socket_io_port": HTTP_PORT}
application = tornado.web.Application(handler, **kwargs)

if __name__ == "__main__":
    import argparse
    import webbrowser

    parser = argparse.ArgumentParser(description="Opens a browser-based "
                                     "client that interfaces with the chemical"
                                     " format converter.")
    parser.add_argument("--debug", action="store_true", help="prints all "
                        "transmitted data streams")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    webbrowser.open("http://localhost:%d/" % HTTP_PORT, new=2)

    context = zmq.Context()
    socket = context.socket(zmq.REP)
    socket.bind("tcp://127.0.0.1:%d" % TCP_PORT)
    stream = zmqstream.ZMQStream(socket, tornado.ioloop.IOLoop.instance())
    stream.on_recv(ClientConnection.on_message)
    tornadio.server.SocketServer(application)
