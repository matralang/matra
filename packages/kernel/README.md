# @matra/kernel

Jupyter protocol kernel for Matra. It works with JupyterLab/Notebook, the VS Code
Jupyter extension, and Google Colab connected to a local Jupyter runtime.

```sh
npm install -g @matra/kernel
matra-kernel install --user
jupyter lab
```

Cells render as HTML by default. A first-line cell magic selects another view:

```text
%%svg   SVG output (use an `svg(...)` Matra tree)
%%json  parsed tree as JSON
%%ast   parsed object-shaped AST
%%html  explicit HTML output
```

For Colab, install the kernel in the local runtime environment and connect Colab
to that local Jupyter server. Colab's hosted Python runtime cannot install a
custom kernelspec; this is a Colab platform restriction rather than a kernel
protocol difference.
