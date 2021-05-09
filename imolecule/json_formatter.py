"""Some small edits to json output.

* Float decimals are truncated to three digits
* [x, y, z] vectors are displayed on one line
* Converts numpy arrays to lists and defined objects to dictionaries
* Removes internal parent references in objects
* Atoms and bonds are on one line each (looks more like other chem formats)
"""
from itertools import takewhile
import re
import json

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

load = json.load
loads = json.loads


def compress(obj):
    """Output json without whitespace + object handling."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"),
                      cls=CustomEncoder)


def dumps(obj):
    """Output json with formatting edits + object handling."""
    return json.dumps(obj, indent=4, sort_keys=True,
                      cls=CustomEncoder)


class CustomEncoder(json.JSONEncoder):
    """Override JSON encoder to make MOF JSON look like CIF/MOL/PDB files."""

    def default(self, obj):
        """Fire when an unserializable object is hit."""
        if hasattr(obj, '__dict__'):
            return self._round_floats(obj.__dict__.copy())
        elif HAS_NUMPY and isinstance(obj, np.ndarray):
            return self._round_floats(obj.copy().tolist())
        else:
            try:
                return self._round_floats(np.asscalar(obj))
            except Exception:
                raise TypeError(f"Object of type {type(obj)} with value of "
                                f"{repr(obj)} is not JSON serializable.")

    def encode(self, obj):
        """Fire for every object."""
        s = super(CustomEncoder, self).encode(self._round_floats(obj))
        # If uncompressed, postprocess for formatting
        if len(s.splitlines()) > 1:
            s = self.postprocess(s)
        return s

    def postprocess(self, json_string):
        """Display float lists as one line in json. Useful for vectors."""
        # As a general rule, all three-element float lists are on one line
        json_string = re.sub(r"\[\s*([-+]?\d*\.?\d*),\s*([-+]?\d*\.?\d*),"
                             r"\s*([-+]?\d*\.?\d*)\s*\]", r"[ \1, \2, \3 ]",
                             json_string)

        # This further compresses atoms and bonds to be on one line
        is_compressing = False
        compressed = []
        spaces = 0
        for row in json_string.split("\n"):
            if is_compressing:
                if row.strip() == "{":
                    compressed.append(row.rstrip())
                elif row.rstrip() == " " * spaces + "],":
                    compressed.append(row.rstrip())
                    is_compressing = False
                else:
                    compressed[-1] += " " + row.strip()
            else:
                compressed.append(row.rstrip())
                if any(a in row for a in ["atoms", "bonds"]):
                    # Fix to handle issues that arise with empty lists
                    if "[]" in row:
                        continue
                    spaces = sum(1 for _ in takewhile(str.isspace, row))
                    is_compressing = True
        return "\n".join(compressed)

    def _round_floats(self, o):
        """Round off floats to clean up outputted JSON.

        From https://stackoverflow.com/a/53798633/1309324
        """
        if isinstance(o, float):
            return round(o, 5)
        if isinstance(o, dict):
            return {k: self._round_floats(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [self._round_floats(x) for x in o]
        return o
