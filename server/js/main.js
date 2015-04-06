/*global $, imolecule, FileReader, Avgrund, document*/
"use strict";

$(document).ready(function () {

    $("#formats").chosen();
    imolecule.create("#imolecule");

    // Only show crystallographic options when we're looking at crystals
    (function () {
        var oldDraw = imolecule.draw;
        imolecule.draw = function () {
            oldDraw.apply(this, arguments);
            $("#camera-type").toggle(this.current.hasOwnProperty("unitcell"));
        };
    }());

    // Draw a sample molecule
    $.getJSON("static/data/caffeine.json", function (molecule) {
        imolecule.filename = "caffeine";
        imolecule.draw(molecule);
    });

    // Basic file i/o logic + background coloring on file hover
    var selector = $("body");
    selector.bind("dragover", function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = "copy";
        selector.css("background", "#449d44");
    });
    selector.bind("dragleave", function (e) {
        selector.css("background", "#fff");
    });
    selector.bind("drop", function (e) {
        var reader, file, name;
        e.stopPropagation();
        e.preventDefault();
        selector.css("background", "#fff");

        reader = new FileReader();
        file = e.originalEvent.dataTransfer.files[0];
        reader.onload = function (loaded) {
            name = file.name.split(".");
            imolecule.filename = name[0];
            imolecule.convertAndDraw(loaded.target.result, name[1]);
        };
        reader.readAsText(file);
    });
});

// Functions encoding button click behavior
var onSaveAsOpen = function () {
    Avgrund.show(".avgrund-popup");
};

var onSaveAsClose = function () {
    Avgrund.hide();
};

var onSave = function () {
    imolecule.convertAndSave(JSON.stringify(imolecule.current), $("#formats option:selected").val());
};

var onCameraType = function () {
    imolecule.setCameraType($("#camera-type").find(":selected").text());
};

var onDrawingType = function () {
    imolecule.setDrawingType($("#drawing-types").find(":selected").text());
};

var onShader = function () {
    imolecule.setShader($("#shaders").find(":selected").text());
};
