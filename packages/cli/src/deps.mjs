import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { env, execPath, platform, stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { authorizePlan, executePlan, planCommands } from "@matra/command"
import {
  getLiterateDependencyDirectory,
  getPythonPackageTarget,
  readLiteratePackages,
  validatePythonWheels,
} from "@matra/core/experimental/literate"

const lockFile = "matra.python.lock.json"
const wheelDirectory = "wheels"

function packageNameKey(name) {
  return name.replaceAll(/[-_.]+/g, "-").toLowerCase()
}

function parsePackageNames(packages, ecosystem, document) {
  const parsed = []
  for (const value of packages) {
    const valid =
      typeof value === "string" &&
      (ecosystem === "javascript"
        ? /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(value)
        : /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))
    if (!valid) {
      throw new Error(`${document}: ${ecosystem} dependencies must be package names only: ${value}`)
    }
    if (!parsed.includes(value)) parsed.push(value)
  }
  return parsed
}

function validWheelPath(file) {
  return (
    typeof file === "string" &&
    file.endsWith(".whl") &&
    !isAbsolute(file) &&
    !file.includes("\\") &&
    file.split("/").every(part => part && part !== "." && part !== "..")
  )
}

function inside(root, target) {
  const path = relative(root, target)
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

async function readExistingLock(root, pyodide) {
  const path = join(root, lockFile)
  let info
  try {
    info = await lstat(path)
  } catch (error) {
    if (error.code === "ENOENT") return new Map()
    throw error
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${lockFile} must be a regular file`)
  }
  const lock = JSON.parse(await readFile(path, "utf8"))
  if (
    lock?.format !== "matra-python-wheels-1" ||
    lock.pyodide !== pyodide ||
    !Array.isArray(lock.packages)
  ) {
    throw new Error(`${lockFile} must use matra-python-wheels-1 for Pyodide ${pyodide}`)
  }
  const rootPath = await realpath(root)
  const packages = new Map()
  const files = new Set()
  for (const entry of lock.packages) {
    const name = packageNameKey(entry?.name ?? "")
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
      typeof entry.version !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9.+!_-]*$/.test(entry.version) ||
      !validWheelPath(entry.file) ||
      entry.name !== name ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      packages.has(name) ||
      files.has(entry.file)
    ) {
      throw new Error(`Invalid or duplicate package entry in ${lockFile}`)
    }
    const path = resolve(rootPath, ...entry.file.split("/"))
    const resolvedPath = await realpath(path)
    const wheel = await lstat(resolvedPath)
    if (!inside(rootPath, resolvedPath) || !wheel.isFile()) {
      throw new Error(`Invalid local wheel path in ${lockFile}: ${entry.file}`)
    }
    const bytes = await readFile(resolvedPath)
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
      throw new Error(`Wheel hash mismatch in ${lockFile}: ${entry.file}`)
    }
    const filename = entry.file.split("/").at(-1)
    const wheelParts = filename.match(
      /^(.+)-([0-9][A-Za-z0-9.+!_]*)(?:-[0-9][A-Za-z0-9.]*)?-py3-none-any\.whl$/,
    )
    if (!wheelParts || packageNameKey(wheelParts[1]) !== name || wheelParts[2] !== entry.version) {
      throw new Error(`Wheel filename does not match package entry: ${entry.file}`)
    }
    packages.set(name, { ...entry, bytes })
    files.add(entry.file)
  }
  return packages
}

function packageFromWheel(file, bytes) {
  const match = file.match(
    /^(.+)-([0-9][A-Za-z0-9.+!_]*)(?:-[0-9][A-Za-z0-9.]*)?-py3-none-any\.whl$/,
  )
  if (!match) throw new Error(`Only py3-none-any wheels are supported: ${file}`)
  const name = packageNameKey(match[1])
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid Python wheel package name: ${file}`)
  }
  return {
    name,
    version: match[2],
    file: `${wheelDirectory}/${file}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
  }
}

function executionPlan(specs) {
  const children = specs.map(({ id, program, args, cwd, writes }) => ({
    tag: "command",
    props: {
      id,
      program,
      args,
      cwd,
      produces: writes,
      capabilities: {
        read: [cwd],
        write: writes,
        network: true,
      },
    },
    children: [],
  }))
  return planCommands({ tag: "root", props: {}, children: children })
}

async function npmInvocation() {
  if (platform !== "win32") return { program: "npm", args: [] }
  const candidates = [
    ...(env.npm_execpath?.endsWith(".js") ? [env.npm_execpath] : []),
    ...(env.PATH ?? "")
      .split(delimiter)
      .filter(Boolean)
      .map(directory => join(directory, "node_modules", "npm", "bin", "npm-cli.js")),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return { program: execPath, args: [candidate] }
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
  throw new Error("Cannot locate npm-cli.js; install npm and ensure it is available on PATH")
}

async function confirmPlan(plan, yes) {
  console.log("The following external commands will run with network access:")
  for (const command of plan.commands) {
    console.log(`  ${command.program} ${command.args.map(arg => JSON.stringify(arg)).join(" ")}`)
  }
  if (yes) return
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Cannot prompt for dependency installation; rerun with --yes to confirm")
  }
  const prompt = createInterface({ input: stdin, output: stdout })
  try {
    const answer = await prompt.question("Continue? [y/N] ")
    if (!/^(y|yes)$/i.test(answer.trim())) throw new Error("Dependency installation cancelled")
  } finally {
    prompt.close()
  }
}

async function ensureDirectory(path) {
  const target = resolve(path)
  const missing = []
  let current = target
  while (true) {
    try {
      const info = await lstat(current)
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Expected a regular directory, not a file or symlink: ${current}`)
      }
      break
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      missing.push(current)
      const parent = dirname(current)
      if (parent === current) throw new Error(`Cannot find a parent directory for ${target}`)
      current = parent
    }
  }
  for (const directory of missing.reverse()) {
    try {
      await mkdir(directory)
    } catch (error) {
      if (error.code !== "EEXIST") throw error
    }
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Expected a regular directory, not a file or symlink: ${directory}`)
    }
  }
}

async function prepareNpmManifest(directory, packages) {
  await ensureDirectory(directory)
  const manifest = join(directory, "package.json")
  try {
    const info = await lstat(manifest)
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error("Generated package.json must be a regular file")
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  const contents = {
    private: true,
    type: "module",
    dependencies: Object.fromEntries(packages.map(name => [name, "*"])),
  }
  await writeFile(manifest, `${JSON.stringify(contents, null, 2)}\n`)
}

async function installPythonPackages(root, requirements, staging, document) {
  const requested = new Set(requirements.map(packageNameKey))
  const wheels = []
  for (const file of await readdir(staging)) {
    if (!file.endsWith(".whl")) continue
    const bytes = await readFile(join(staging, file))
    wheels.push(packageFromWheel(file, bytes))
  }
  if (wheels.length === 0) throw new Error("pip download completed without producing any wheels")
  const names = new Set()
  for (const wheel of wheels) {
    if (names.has(wheel.name)) throw new Error(`pip produced duplicate wheels for ${wheel.name}`)
    names.add(wheel.name)
  }
  for (const name of requested) {
    if (!names.has(name)) {
      throw new Error(`pip did not produce the requested Python package: ${name}`)
    }
  }
  await validatePythonWheels(wheels, document)

  const wheelRoot = join(root, wheelDirectory)
  await ensureDirectory(wheelRoot)
  for (const wheel of wheels) {
    const destination = join(wheelRoot, wheel.file.split("/").at(-1))
    try {
      await copyFile(
        join(staging, wheel.file.split("/").at(-1)),
        destination,
        constants.COPYFILE_EXCL,
      )
    } catch (error) {
      if (error.code !== "EEXIST") throw error
      const info = await lstat(destination)
      if (!info.isFile() || info.isSymbolicLink()) {
        throw new Error(`Refusing to overwrite a non-regular wheel file: ${wheel.file}`)
      }
      const existing = await readFile(destination)
      if (!existing.equals(wheel.bytes)) {
        throw new Error(`Refusing to overwrite a different wheel file: ${wheel.file}`)
      }
    }
  }
  const lock = {
    format: "matra-python-wheels-1",
    pyodide: getPythonPackageTarget().pyodide,
    packages: wheels
      .map(({ bytes: _bytes, ...entry }) => entry)
      .sort((left, right) => left.name.localeCompare(right.name)),
  }
  const temporary = join(root, `.${lockFile}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" })
    await rename(temporary, join(root, lockFile))
  } finally {
    await rm(temporary, { force: true })
  }
  console.log(`Updated: ${lockFile} (${wheels.length} wheel(s) downloaded)`)
}

export async function installDependencies(
  root,
  ecosystem,
  documentPath,
  yes = false,
  update = false,
) {
  if (ecosystem !== "npm" && ecosystem !== "python") {
    throw new Error("Specify an ecosystem: npm or python")
  }
  root = await realpath(resolve(root))
  if (!documentPath || isAbsolute(documentPath) || documentPath.split(/[\\/]/).includes("..")) {
    throw new Error("Specify a Markdown document path relative to the project root")
  }
  const document = resolve(root, documentPath)
  if (!inside(root, document)) throw new Error("Document path must remain inside the project root")
  const documentInfo = await lstat(document)
  if (!documentInfo.isFile() || documentInfo.isSymbolicLink()) {
    throw new Error("Document path must be a regular file inside the project root")
  }
  const documentName = relative(root, document)
  const markdown = await readFile(document, "utf8")
  const declared = readLiteratePackages(markdown, { document: documentName })
  const packages = parsePackageNames(
    declared[ecosystem === "npm" ? "javascript" : "python"],
    ecosystem === "npm" ? "javascript" : "python",
    documentName,
  )
  if (packages.length === 0) {
    console.log(`No ${ecosystem} dependencies declared in ${documentName}.`)
    return
  }

  const dependencyRoot = getLiterateDependencyDirectory(
    root,
    documentName,
    ecosystem === "npm" ? "javascript" : "python",
  )
  await ensureDirectory(dependencyRoot)
  const stagingRoot = ecosystem === "python" ? await mkdtemp(join(tmpdir(), "matra-python-")) : null
  try {
    const specs = []
    let npmCommand
    let pythonWheels
    let pythonConstraints
    if (ecosystem === "npm") {
      npmCommand = await npmInvocation()
      specs.push({
        id: update ? "npm-update" : "npm-install",
        program: npmCommand.program,
        args: [
          ...npmCommand.args,
          update ? "update" : "install",
          "--prefix",
          dependencyRoot,
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
        ],
        cwd: root,
        writes: [dependencyRoot],
      })
    }
    if (ecosystem === "python") {
      const target = getPythonPackageTarget()
      const oldPackages = update
        ? new Map()
        : await readExistingLock(dependencyRoot, target.pyodide)
      pythonWheels = join(stagingRoot, "wheels")
      await mkdir(pythonWheels)
      const args = [
        "-m",
        "pip",
        "download",
        "--only-binary=:all:",
        "--implementation",
        "py",
        "--python-version",
        target.python.split(".").slice(0, 2).join("."),
        "--abi",
        "none",
        "--platform",
        "any",
        "--dest",
        pythonWheels,
      ]
      if (oldPackages.size) {
        pythonConstraints = join(stagingRoot, "constraints.txt")
        await writeFile(
          pythonConstraints,
          [...oldPackages.values()].map(({ name, version }) => `${name}==${version}\n`).join(""),
        )
        args.push("--constraint", pythonConstraints)
      }
      args.push(...packages)
      const python =
        process.env.MATRA_PYTHON ?? (process.platform === "win32" ? "python" : "python3")
      specs.push({
        id: "python-wheels",
        program: python,
        args,
        cwd: root,
        writes: [stagingRoot, dependencyRoot],
      })
    }
    const plan = executionPlan(specs)
    await confirmPlan(plan, yes)
    if (ecosystem === "npm") await prepareNpmManifest(dependencyRoot, packages)
    const authorized = authorizePlan(plan, {
      commands: plan.capabilities.commands,
      read: plan.capabilities.read,
      write: plan.capabilities.write,
      network: true,
    })
    const controller = new AbortController()
    const abort = () => controller.abort()
    process.once("SIGINT", abort)
    process.once("SIGTERM", abort)
    let result
    try {
      result = await executePlan(authorized, {
        signal: controller.signal,
        onEvent: event => {
          if (event.type === "finish" && event.result?.status !== "ok") {
            console.error(
              `${event.command.id}: ${event.result?.error ?? event.result?.stderr ?? "failed"}`,
            )
          }
        },
      })
    } finally {
      process.removeListener("SIGINT", abort)
      process.removeListener("SIGTERM", abort)
    }
    if (result.status !== "ok") throw new Error("Dependency command failed")
    if (ecosystem === "python") {
      await installPythonPackages(dependencyRoot, packages, pythonWheels, documentName)
    }
  } finally {
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true })
  }
}
