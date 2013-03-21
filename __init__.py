from IPython.display import Javascript, display
import re
import os
from molecule_to_json import generate_json
import json_formatter

# Load required assets on import
path = os.path.dirname(os.path.realpath(__file__))
js = {"sizes": "/json/atom_diameters.json", "colors": "/json/atom_colors.json",
      "script": "/js/drawer_ipython.js", "three": "/js/three.min.js",
      "controls": "/js/TrackballControls.js", "toon": "/js/ShaderToon.js"}
for key, filename in js.items():
    with open(path + filename) as in_js:
        js[key] = in_js.read()

# This is the only way I found to use local copies of js libraries in IPython
js["script"] = js["three"] + js["controls"] + js["toon"] + js["script"]


def draw(data, format="auto", optimize=True, add_h=False, size=(400, 225),
         toon=True):
    """Draws an interactive 3D visualization of the inputted chemical.

    Arguments:
    data -- A string or file representing a chemical
    format -- The format of the `data` variable (default is "auto")
    optimize -- Generates 3D coordinates (default is True)
    add_h -- Adds hydrogen atoms to visualization (default is False)
    size -- Dimensions of visualization, in pixels (default is (400, 225))
    toon -- Use a toon-shader postprocessor (default is True)

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The "auto"
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.

    Set `optimize=False` when you want to view large molecules with
    pregenerated data (ie. cif, pdb).
    """

    # This stitches together js and json to create a runnable js string
    js["molecule"] = generate(data, format, optimize, add_h)
    js["w"], js["h"] = [str(s) for s in size]
    js["toon"] = "true" if toon else "false"
    drawer = re.sub("#\(\w+\)", lambda m: js[m.group()[2:-1]], js["script"])

    # This runs the generated js. Check the `drawer` string for js debugging
    display(Javascript(data=drawer))


def generate(data, format="auto", optimize=True, add_h=False):
    """Converts input chemical formats to json and optimizes structure.

    Arguments:
    data -- A string or file representing a chemical
    format -- The format of the `data` variable (default is "auto")
    optimize -- Generates 3D coordinates (default is True)
    add_h -- Adds hydrogen atoms to visualization (default is False)

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The "auto"
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.

    Set `optimize=False` with formats that come with pre-generated locational
    data.
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

    return data if format == "json" else generate_json(data, format,
                                                       optimize, add_h)

def to_json(data):
    """Converts the output of `generate(...)` to formatted json.

    Floats are rounded to three decimals and positional vectors are printed on
    one line with some whitespace buffer.
    """
    return json_formatter.dumps(data)
