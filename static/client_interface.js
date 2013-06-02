/*global io, $, window, console, alert, Blob, saveAs*/
"use strict";
/**
 * Function calls across sockets to the mof generator
 */
var client = {
    filename: "output",
    queue: {},

    // Connects to Python via a socketio-zeromq bridge
    connect: function (http_port) {
        this.socket = new io.Socket(window.location.hostname,
                                    {port: http_port, rememberTransport: false});
        this.socket.connect();

        this.socket.on("connect", function () {
            console.log("Connected!");
        });

        var self = this;
        this.socket.on("message", function (data) {
            var router, f;
            router = self.queue[data.id];
            delete self.queue[data.id];
            self.result = data.result;

            if (data.error) {
                alert(data.result);
                return;
            }

            if (router === "draw") {
                self.viewer.clear();
                self.viewer.drawMolecule($.parseJSON(data.result));
            } else if (router === "save") {
                f = self.filename + "." + self.out_format;
                saveAs(new Blob([data.result], {type: "text/plain"}), f);
            } else {
                alert("Unsupported function: " + router);
            }
        });
    },

    // Set references to other classes (cleaner than globals)
    set_references: function (viewer) {
        this.viewer = viewer;
    },

    // Generates a unique identifier for request ids
    // Code from http://stackoverflow.com/questions/105034/
    // how-to-create-a-guid-uuid-in-javascript/2117523#2117523
    uuid: function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

    // Standardizes chemical drawing formats and draws
    convert_and_draw: function (data, inFormat) {
        // Skips a socket call if not needed
        if (inFormat === "json") {
            this.viewer.clear();
            this.viewer.drawMolecule($.parseJSON(data));
            return;
        }

        var uuid = this.uuid();
        this.socket.send({method: "convert", id: uuid,
                          params: {data: data, in_format: inFormat,
                                   out_format: "json", pretty: false}
                         });
        this.queue[uuid] = "draw";
    },

    // Converts and saves output
    convert_and_save: function (data, outFormat) {
        var uuid = this.uuid();
        this.socket.send({method: "convert", id: uuid,
                          params: {data: data, in_format: "json",
                                   out_format: outFormat, pretty: true}
                         });
        this.out_format = outFormat;
        this.queue[uuid] = "save";
    }
};

