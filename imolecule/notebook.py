import os
import uuid

import IPython
from IPython.display import HTML, display

import imolecule.json_formatter as json
from imolecule import format_converter

file_path = os.path.normpath(os.path.dirname(__file__))
local_path = 'nbextensions/imolecule.min.js'
remote_path = ('https://rawgit.com/patrickfuller/imolecule/master/'
               'imolecule/js/build/imolecule.min.js')

if IPython.release.version < '2.0':
    raise ImportError("Old version of IPython detected. Please update.")
else:
    try:
        if IPython.release.version < '4.0':
            from IPython.html.nbextensions import install_nbextension
        else:
            from notebook.nbextensions import install_nbextension
        p = os.path.join(file_path, 'js', 'build', 'imolecule.min.js')
        install_nbextension([p] if IPython.release.version < '3.0' else p,
                            verbose=0)
    except:
        pass


def draw(data, format='auto', size=(400, 300), drawing_type='ball and stick',
         camera_type='perspective', shader='lambert', display_html=True):
    """Draws an interactive 3D visualization of the inputted chemical.

    Args:
        data: A string or file representing a chemical.
        format: The format of the `data` variable (default is 'auto').
        size: Starting dimensions of visualization, in pixels.
        drawing_type: Specifies the molecular representation. Can be 'ball and
            stick', 'wireframe', or 'space filling'.
        camera_type: Can be 'perspective' or 'orthographic'.
        shader: Specifies shading algorithm to use. Can be 'toon', 'basic',
            'phong', or 'lambert'.
        display_html: If True (default), embed the html in a IPython display.
            If False, return the html as a string.

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The 'auto'
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.
    """
    # Catch errors on string-based input before getting js involved
    draw_options = ['ball and stick', 'wireframe', 'space filling']
    camera_options = ['perspective', 'orthographic']
    shader_options = ['toon', 'basic', 'phong', 'lambert']
    if drawing_type not in draw_options:
        raise Exception("Invalid drawing type! Please use one of: " +
                        ", ".join(draw_options))
    if camera_type not in camera_options:
        raise Exception("Invalid camera type! Please use one of: " +
                        ", ".join(camera_options))
    if shader not in shader_options:
        raise Exception("Invalid shader! Please use one of: " +
                        ", ".join(shader_options))

    json_mol = generate(data, format)
    div_id = uuid.uuid4()
    html = """<div id="molecule_%s"></div>
           <script type="text/javascript">
           require.config({baseUrl: '/',
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
        try:
            __IPYTHON__
        except NameError:
            # We're running outside ipython, let's generate a static HTML and
            # show it in the browser
            import shutil
            import webbrowser
            from tempfile import mkdtemp
            from time import time
            try:  # Python 3
                from urllib.parse import urljoin
                from urllib.request import pathname2url
            except ImportError:  # Python 2
                from urlparse import urljoin
                from urllib import pathname2url
            from tornado import template

            t = template.Loader(file_path).load('viewer.template')
            html = t.generate(title="imolecule", json_mol=json_mol,
                              drawing_type=drawing_type, shader=shader,
                              camera_type=camera_type)

            tempdir = mkdtemp(prefix='imolecule_{:.0f}_'.format(time()))

            html_filename = os.path.join(tempdir, 'index.html')
            with open(html_filename, 'wb') as f:
                f.write(html)

            libs = (('server', 'css', 'chosen.css'),
                    ('server', 'css', 'server.css'),
                    ('js', 'jquery-1.11.1.min.js'),
                    ('server', 'js', 'chosen.jquery.min.js'),
                    ('js', 'build', 'imolecule.min.js'))
            for lib in libs:
                shutil.copy(os.path.join(file_path, *lib), tempdir)

            html_file_url = urljoin('file:', pathname2url(html_filename))

            print('Opening html file: {}'.format(html_file_url))
            webbrowser.open(html_file_url)
        else:
            # We're running in ipython: display widget
            display(HTML(html))
    else:
        return html


def generate(data, format="auto"):
    """Converts input chemical formats to json and optimizes structure.

    Args:
        data: A string or file representing a chemical
        format: The format of the `data` variable (default is 'auto')

    The `format` can be any value specified by Open Babel
    (http://openbabel.org/docs/2.3.1/FileFormats/Overview.html). The 'auto'
    option uses the extension for files (ie. my_file.mol -> mol) and defaults
    to SMILES (smi) for strings.
    """
    # Support both files and strings and attempt to infer file type
    try:
        with open(data) as in_file:
            if format == 'auto':
                format = data.split('.')[-1]
            data = in_file.read()
    except:
        if format == 'auto':
            format = 'smi'
    return format_converter.convert(data, format, 'json')


def to_json(data, compress=False):
    """Converts the output of `generate(...)` to formatted json.

    Floats are rounded to three decimals and positional vectors are printed on
    one line with some whitespace buffer.
    """
    return json.compress(data) if compress else json.dumps(data)
