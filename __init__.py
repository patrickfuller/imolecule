from IPython.display import HTML, Javascript, display
import re
import os
from uuid import uuid4 as uuid
from molecule_to_json import generate_json

# Load required assets on import
path = os.path.dirname(os.path.realpath(__file__))
js = {"sizes": path + "/json/atom_diameters.json",
      "colors": path + "/json/atom_colors.json",
      "script": path + "/js/drawer_ipython.js",
      "three": path + "/js/three.min.js",
      "controls": path + "/js/TrackballControls.js"}
for key, filename in js.items():
    with open(filename) as in_js:
        js[key] = in_js.read()

# This is the only way I found to use local copies of js libraries in IPython
js["script"] = js["three"] + js["controls"] + js["script"]


def draw(data, format="auto", optimize=True, add_h=False, size=(400, 225)):
    """Draws an interactive 3D visualization of the inputted chemical.

    Arguments:
    data -- A string or file representing a chemical
    format -- The format of the `data` variable (default is "auto")
    optimize -- Generates 3D coordinates (default is True)
    add_h -- Adds hydrogen atoms to visualization (default is False)
    size -- Dimensions of visualization, in pixels (default is (400, 225))

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

    # This stitches together js and json to create a runnable js string
    id = "molecule_%s" % uuid()
    js["molecule"] = (data if format == "json"
                      else generate_json(data, format, optimize, add_h))
    js["w"], js["h"] = [str(s) for s in size]
    js["selector"] = "#" + id
    drawer = re.sub("#\(\w+\)", lambda m: js[m.group()[2:-1]], js["script"])

    # Create a div with a handle to display molecule, then execute js
    display(HTML(('<div id=%s '
                  'style="min-width: %dpx; height: %dpx;" />'
                  % tuple([id] + list(size)))))
    display(Javascript(data=drawer))
