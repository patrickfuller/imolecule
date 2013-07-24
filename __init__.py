from IPython.display import Javascript, display
import os
import json_formatter as json
import format_converter

# Load required assets on import (IPython comes with jQuery)
PATH = os.path.normpath(os.path.dirname(__file__))
LIB = ["lib/three.min.js", "lib/TrackballControls.js",
       "lib/ShaderToon.js", "imolecule.js"]

# This is the only way I found to use local copies of js libraries in IPython
lib_script = ""
for filename in LIB:
    with open(os.path.join(PATH, filename)) as in_js:
        lib_script += in_js.read()


def draw(data, format="auto", size=(400, 225), drawing_type="ball and stick",
         camera_type="perspective"):
    """Draws an interactive 3D visualization of the inputted chemical.

    Args:
        data: A string or file representing a chemical
        format: The format of the `data` variable (default is "auto")
        size: Dimensions of visualization, in pixels (default is (400, 225))
        drawing_type: Specifies the molecular representation. Can be "ball and
            stick", "wireframe", or "space filling"
        camera_type: Can be "perspective" or "orthographic"

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The "auto"
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.
    """
    # Catch errors on string-based input before getting js involved
    draw_options = ["ball and stick", "wireframe", "space filling"]
    if drawing_type not in draw_options:
        raise Exception("Invalid drawing type! Please use one of: "
                        + ", ".join(draw_options))
    if camera_type not in ["perspective", "orthographic"]:
        raise Exception("Invalid camera type! Please use 'perspective' or"
                        "'orthographic'.")

    # Magic.
    script = ("var $d = $('<div/>').attr('id', 'molecule_' + utils.uuid());"
              "$d.width(%d); $d.height(%d);"
              "imolecule.create($d, {drawingType: '%s', cameraType: '%s'});"
              "imolecule.draw(%s);"
              "container.show();"
              "element.append($d);" % (size[0], size[1], drawing_type,
              camera_type, generate(data, format)))

    # Execute js and display the results in a div (see script for more)
    display(Javascript(data=lib_script + script))


def generate(data, format="auto"):
    """Converts input chemical formats to json and optimizes structure.

    Args:
        data: A string or file representing a chemical
        format: The format of the `data` variable (default is "auto")

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The "auto"
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.
    """
    # Support both files and strings and attempt to infer file type
    try:
        with open(data) as in_file:
            if format == "auto":
                format = data.split(".")[-1]
            data = in_file.read()
    except:
        if format == "auto":
            format = "smi"
    return format_converter.convert(data, format, "json")

def to_json(data, compress=False):
    """Converts the output of `generate(...)` to formatted json.

    Floats are rounded to three decimals and positional vectors are printed on
    one line with some whitespace buffer.
    """
    return json.compress(data) if compress else json.dumps(data)
