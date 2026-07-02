import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import process from "node:process"
import { Publisher, Reply, Router } from "zeromq"
import { complete, completeness, evaluate, inspect } from "./runtime.js"
import { decode, encode, makeHeader } from "./message.js"

const protocolVersion = "5.3"

export class MatraKernel {
  constructor(connection) {
    this.connection = connection
    this.executionCount = 0
    this.history = []
    this.session = randomUUID()
    this.stopping = false
    this.sockets = {}
  }

  static async fromFile(path) {
    return new MatraKernel(JSON.parse(await readFile(path, "utf8")))
  }

  async start() {
    const { ip, transport, shell_port, control_port, stdin_port, iopub_port, hb_port } = this.connection
    const address = port => `${transport}://${ip}:${port}`
    Object.assign(this.sockets, {
      shell: new Router(), control: new Router(), stdin: new Router(),
      iopub: new Publisher(), heartbeat: new Reply(),
    })
    await Promise.all([
      this.sockets.shell.bind(address(shell_port)), this.sockets.control.bind(address(control_port)),
      this.sockets.stdin.bind(address(stdin_port)), this.sockets.iopub.bind(address(iopub_port)),
      this.sockets.heartbeat.bind(address(hb_port)),
    ])
    await Promise.all([
      this.serve(this.sockets.shell, "shell"),
      this.serve(this.sockets.control, "control"),
      this.heartbeat(),
    ])
  }

  async serve(socket, channel) {
    try {
      for await (const frames of socket) {
        try { await this.handle(socket, [...frames], channel) }
        catch (error) { console.error(`[matra-kernel] ${error.stack ?? error}`) }
        if (this.stopping) break
      }
    } catch (error) {
      if (!this.stopping) throw error
    }
  }

  async heartbeat() {
    try {
      for await (const frames of this.sockets.heartbeat) {
        await this.sockets.heartbeat.send(frames)
        if (this.stopping) break
      }
    } catch (error) {
      if (!this.stopping) throw error
    }
  }

  async handle(socket, frames) {
    const request = decode(frames, this.connection.key, this.connection.signature_scheme)
    const type = request.header.msg_type
    if (type === "execute_request") return this.execute(socket, request)

    let content
    switch (type) {
      case "kernel_info_request": content = kernelInfo(); break
      case "complete_request": content = complete(request.content.code, request.content.cursor_pos); break
      case "inspect_request": content = inspect(request.content.code, request.content.cursor_pos); break
      case "is_complete_request": content = completeness(request.content.code); break
      case "history_request": content = { status: "ok", history: this.history }; break
      case "comm_info_request": content = { status: "ok", comms: {} }; break
      case "interrupt_request": content = { status: "ok" }; break
      case "shutdown_request":
        content = { status: "ok", restart: Boolean(request.content.restart) }
        await this.reply(socket, request, "shutdown_reply", content)
        setTimeout(() => this.stop(), 10)
        return
      default: content = { status: "ok" }
    }
    await this.reply(socket, request, type.replace(/_request$/, "_reply"), content)
  }

  async execute(socket, request) {
    const { code = "", silent = false, store_history = true, user_expressions = {} } = request.content
    if (!silent && store_history) {
      this.executionCount += 1
      this.history.push([0, this.executionCount, code])
    }
    const count = this.executionCount
    await this.publish(request, "status", { execution_state: "busy" })
    if (!silent) await this.publish(request, "execute_input", { code, execution_count: count })
    try {
      const output = evaluate(code)
      if (output && !silent) {
        await this.publish(request, "execute_result", { ...output, execution_count: count })
      }
      const expressions = {}
      for (const [name, expression] of Object.entries(user_expressions)) {
        try { expressions[name] = { status: "ok", ...evaluate(expression) } }
        catch (error) { expressions[name] = errorContent(error) }
      }
      await this.reply(socket, request, "execute_reply", {
        status: "ok", execution_count: count, payload: [], user_expressions: expressions,
      })
    } catch (error) {
      const content = errorContent(error)
      await this.publish(request, "error", content)
      await this.reply(socket, request, "execute_reply", { ...content, execution_count: count })
    } finally {
      await this.publish(request, "status", { execution_state: "idle" })
    }
  }

  async reply(socket, request, msgType, content) {
    await socket.send(this.frames(request.identities, request, msgType, content))
  }

  async publish(request, msgType, content) {
    const topic = Buffer.from(`kernel.${this.session}.${msgType}`)
    await this.sockets.iopub.send(this.frames([topic], request, msgType, content))
  }

  frames(identities, request, msgType, content) {
    return encode({ identities, header: makeHeader(msgType, this.session), parentHeader: request.header, content },
      this.connection.key, this.connection.signature_scheme)
  }

  stop() {
    this.stopping = true
    for (const socket of Object.values(this.sockets)) socket.close()
  }
}

function kernelInfo() {
  return {
    status: "ok", protocol_version: protocolVersion,
    implementation: "matra", implementation_version: "0.1.0",
    language_info: {
      name: "matra", version: "0.2.0", mimetype: "text/x-matra",
      file_extension: ".matra", pygments_lexer: "text", codemirror_mode: "matra",
      nbconvert_exporter: "script",
    },
    banner: "Matra Kernel — HTML, SVG, AST, and MatraJSON notebooks",
    help_links: [{ text: "Matra", url: "https://github.com/matralang/matra" }],
  }
}

function errorContent(error) {
  const name = error?.name ?? "Error"
  const message = error?.message ?? String(error)
  return { status: "error", ename: name, evalue: message, traceback: [`${name}: ${message}`] }
}
