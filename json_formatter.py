"""
Some small edits to json output.
 * Float decimals are truncated to three digits
 * [x, y, z] vectors are displayed on one line
 * Converts numpy arrays to lists and defined objects to dictionaries
"""

import numpy as np

import json
from json import encoder
encoder.FLOAT_REPR = lambda o: format(o, '.6f')

load = json.load
loads = json.loads


def JsonableHandler(obj):
    if hasattr(obj, '__dict__'):
        return obj.__dict__.copy()
    elif isinstance(obj, np.ndarray):
        return obj.copy().tolist()
    else:
        raise TypeError(("Object of type %s with value of %s is not JSON "
                        "serializable") % (type(obj), repr(obj)))


def compress(obj):
    """Outputs json without whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"),
                      default=JsonableHandler)


def dumps(obj):
    """Outputs json with formatting edits + object handling."""
    # Pretty print json string with truncated floats
    json_string = json.dumps(obj, indent=4, sort_keys=True,
                             default=JsonableHandler)
    # Make all lists of floats one line and return
    return re.sub("\[\s*([-+]?\d*\.\d*), \s*([-+]?\d*\.\d*), "
                  "\s*([-+]?\d*\.\d*)\s*\]", r"[ \1, \2, \3 ]", json_string)
