/*global io, $, window, console, alert*/
"use strict";
/**
 * Function calls across sockets to the mof generator
 */
var client = {

    queue: {},

    // Connects to Python via a socketio-zeromq bridge
    connect: function () {
        this.socket = new io.Socket(window.location.hostname,
                                    {port: 8000, rememberTransport: false});
        this.socket.connect();

        this.socket.on("connect", function () {
            console.log("Connected!");
        });

        var self = this;
        this.socket.on("message", function (data) {
            var router = self.queue[data.id];
            delete self.queue[data.id];

            if (data.error) {
                alert(data.result);
                return;
            }

            if (router === "stream_convert") {
                self.viewer.clear();
                self.viewer.draw($.parseJSON(data.result));
            } else if (router === "extract") {
                self.viewer.clear();
                self.viewer.draw($.parseJSON(data.result.json));
                window.open(data.result.url, "_blank");
            } else if (router === "batch_convert" || router === "batch_molecules") {
                window.location = data.result;
            } else if (router === "stream_molecule" || router === "stream_mof") {
                self.viewer.clear();
                self.viewer.draw($.parseJSON(data.result));
                $(".test").hide();
                $(".mof-viewer").show();
            }
        });
    },

    // Sets a reference to a viewer object. Used in handling molecule drawing
    set_viewer: function (viewer) {
        this.viewer = viewer;
    },

    // Generates a unique identifier for request ids
    // Beautiful code from http://stackoverflow.com/questions/105034/
    // how-to-create-a-guid-uuid-in-javascript/2117523#2117523
    uuid: function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

    // Converts chemical data format files for immediate re-use
    stream_convert: function (data, filename, inFormat, outFormat) {
        var uuid = this.uuid();
        this.socket.send({method: "stream_convert", id: uuid,
                          params: {data: data,
                                   filename: filename,
                                   in_format: inFormat,
                                   out_format: outFormat}});
        this.queue[uuid] = "stream_convert";
    },

    // Converts a list of files and returns a downloadable file
    batch_convert: function (files, outFormat) {
        var uuid = this.uuid();
        this.socket.send({method: "batch_convert", id: uuid,
                          params: {files: files,
                                   out_format: outFormat}});
        this.queue[uuid] = "batch_convert";
    },

    // Converts building blocks into a molecule for debugging
    stream_molecule: function (blocks) {
        var uuid = this.uuid();
        this.socket.send({method: "stream_molecule", params: this.format(blocks, false), id: uuid});
        this.queue[uuid] = "stream_molecule";
    },

    // Converts building blocks into a mof for debugging
    stream_mof: function (blocks) {
        var uuid = this.uuid();
        this.socket.send({method: "stream_mof", params: this.format(blocks, true), id: uuid});
        this.queue[uuid] = "stream_mof";
    },

    // Creates all combinations of molecules and mofs from starting materials
    batch_molecules: function (blocks) {
        var uuid = this.uuid();
        this.socket.send({method: "batch_molecules", params: {files: blocks}, id: uuid});
        this.queue[uuid] = "batch_molecules";
    },

    // Takes manually extracted atoms and attempts to create a building block
    extract: function (atoms) {
        var uuid = this.uuid();
        this.socket.send({method: "extract", params: {atoms: atoms}, id: uuid});
        this.queue[uuid] = "extract";
    },

    // Formats arguments for streaming molecules or mofs
    format: function (blocks, isMof) {
        if (!blocks.hasOwnProperty("organic fragment")) {
            alert("No organic fragment file specified!");
            return;
        }
        if (isMof && !blocks.hasOwnProperty("metal")) {
            alert("No metal file specified!");
            return;
        }
        var args = { fragment: blocks["organic fragment"] };
        if (isMof) {
            args.metal = blocks.metal;
        }
        if (blocks.hasOwnProperty("functional group")) {
            args.functional_group = blocks["functional group"];
        }
        if (blocks.hasOwnProperty("linker group")) {
            args.linker_group = blocks["linker group"];
        }
        return args;
    }
};
