#!/usr/bin/env python
"""
Some small edits to json output.
 * Float decimals are truncated to three digits
 * [x, y, z] vectors are displayed on one line
 * Converts numpy arrays to lists and defined objects to dictionaries
 * Removes internal parent references in objects
"""

import numpy as np

import json
from json import encoder
encoder.FLOAT_REPR = lambda o: format(o, '.6f')

load = json.load
loads = json.loads


def JsonableHandler(obj):
    if hasattr(obj, '__dict__'):
        d = obj.__dict__.copy()
        d.pop("parent_block", None)
        return d
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
    return make_one_line_lists(json_string)


def make_one_line_lists(json_string):
    """Display float lists as one line in json. Useful for vectors."""
    json_string = json_string.split("\n")
    for i, row in enumerate(json_string):

        # Iterate through all rows that start a list
        if row[-1] != "[" or not has_next_float(json_string, i):
            continue

        # Move down rows until the list ends, deleting and appending.
        while has_next_float(json_string, i):
            row += " " + json_string[i + 1].strip()
            del json_string[i + 1]

        # Finish off with the closing bracket
        json_string[i] = row + " " + json_string[i + 1].strip()
        del json_string[i + 1]

    # Recombine the list into a string and return
    return "\n".join(json_string)


def has_next_float(json_string, i):
    """Tests if the next row in a split json string is a float."""
    try:
        float(json_string[i + 1].strip().replace(",", ""))
        return True
    except:
        return False
