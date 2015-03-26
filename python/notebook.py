from IPython.display import HTML, display
import os
import uuid
import imolecule.json_formatter as json
from imolecule import format_converter

filename = "imolecule.min.js"
file_path = os.path.normpath(os.path.dirname(__file__))
local_path = os.path.join("nbextensions", filename)
remote_path = ("https://rawgit.com/patrickfuller/imolecule/master/"
               "js/build/imolecule.min.js")


def draw(data, format="auto", size=(400, 300), drawing_type="ball and stick",
         camera_type="perspective", shader="toon", display_html=True):
    """Draws an interactive 3D visualization of the inputted chemical.

    Args:
        data: A string or file representing a chemical.
        format: The format of the `data` variable (default is "auto").
        size: Starting dimensions of visualization, in pixels.
        drawing_type: Specifies the molecular representation. Can be "ball and
            stick", "wireframe", or "space filling".
        camera_type: Can be "perspective" or "orthographic".
        shader: Specifies shading algorithm to use. Can be "toon", "basic",
            "phong", or "lambert".
        display_html: If True (default), embed the html in a IPython display,
            if False, returns the html as a string.

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The "auto"
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.
    """
    # Catch errors on string-based input before getting js involved
    draw_options = ["ball and stick", "wireframe", "space filling"]
    camera_options = ["perspective", "orthographic"]
    shader_options = ["toon", "basic", "phong", "lambert"]
    if drawing_type not in draw_options:
        raise Exception("Invalid drawing type! Please use one of: "
                        + ", ".join(draw_options))
    if camera_type not in camera_options:
        raise Exception("Invalid camera type! Please use one of: "
                        + ", ".join(camera_options))
    if shader not in shader_options:
        raise Exception("Invalid shader! Please use one of: "
                        + ", ".join(shader_options))

    # Try using IPython >=2.0 to install js locally
    try:
        from IPython.html.nbextensions import install_nbextension
        install_nbextension([os.path.join(file_path,
                             "js/build", filename)], verbose=0)
    except:
        pass

    json_mol = generate(data, format)
    div_id = uuid.uuid4()
    html = """<div id="molecule_%s"></div>
           <script type="text/javascript">
           require.config({baseUrl: "/",
                             paths: {imolecule: ['%s', '%s']}});
           require(['imolecule'], function () {
               var $d = $('#molecule_%s');
               $d.width(%d); $d.height(%d);
               $d.imolecule = jQuery.extend({}, imolecule);
               $d.imolecule.create($d, {drawingType: '%s',
                                        cameraType: '%s',
                                        shader: '%s'});
               $d.imolecule.draw(%s);

               $d.resizable({
                   aspectRatio: %d / %d,
                   resize: function (evt, ui) {
                       $d.imolecule.renderer.setSize(ui.size.width,
                                                     ui.size.height);
                   }
               });
           });
           </script>""" % (div_id, local_path[:-3], remote_path[:-3],
                           div_id, size[0], size[1], drawing_type,
                           camera_type, shader, json_mol, size[0], size[1])

    # Execute js and display the results in a div (see script for more)
    if display_html:
        display(HTML(html))
    else:
        return html


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
