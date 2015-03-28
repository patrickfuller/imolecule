from setuptools import setup

setup(
    name="imolecule",
    version="0.1.4",
    description="View molecules in the IPython notebook.",
    url="http://github.com/patrickfuller/imolecule/",
    license="MIT",
    author="Patrick Fuller",
    author_email="patrickfuller@gmail.com",
    package_dir={"imolecule": "python",
                 "imolecule.server": "server",
                 "imolecule.js": "js"},
    package_data={"imolecule.js": ["js/build/imolecule.min.js"],
                  "imolecule.server": ["server/data/*.json",
                                       "server/js/*.js",
                                       "server/css/*.css",
                                       "server/*.template"]},
    include_package_data=True,
    packages=["imolecule", "imolecule.server", "imolecule.js"],
    install_requires=["ipython", "tornado"],
    entry_points={
        "console_scripts": [
            "imolecule = imolecule.server:start_server"
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "Natural Language :: English",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.4",
        "Framework :: IPython",
        "Topic :: Education :: Computer Aided Instruction (CAI)",
        "Topic :: Scientific/Engineering :: Bio-Informatics",
        "Topic :: Scientific/Engineering :: Chemistry",
        "Topic :: Scientific/Engineering :: Visualization"
    ]
)
