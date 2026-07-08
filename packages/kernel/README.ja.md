# @matra/kernel

[English](./README.md) | [日本語](./README.ja.md)

Matra用のJupyter protocol kernelです。JupyterLab / Notebook、VS Code Jupyter extension、local Jupyter runtimeへ接続したGoogle Colabで動作します。

```sh
npm install -g @matra/kernel
matra-kernel install --user
jupyter lab
```

Cellは既定でHTMLとしてrenderされます。先頭行のcell magicで別の表示形式を選択できます。

```text
%%svg   SVG output (`svg(...)` Matra treeを使用)
%%json  parsed tree as JSON
%%ast   parsed object-shaped AST
%%html  explicit HTML output
```

Colabで使う場合は、local runtime環境へkernelをinstallし、Colabをそのlocal Jupyter serverへ接続します。Colabのhosted Python runtimeにはcustom kernelspecをinstallできません。これはkernel protocolの差ではなく、Colab platform側の制約です。
