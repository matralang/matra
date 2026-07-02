import assert from "node:assert/strict"
import test from "node:test"
import { MatraKernel } from "../src/kernel.js"
import { encode, makeHeader } from "../src/message.js"

test("announces busy and idle while answering kernel_info", async () => {
  const connection = { key: "secret", signature_scheme: "hmac-sha256" }
  const kernel = new MatraKernel(connection)
  const published = []
  kernel.publish = async (_request, type, content) => published.push([type, content])
  const socket = { send: async () => {} }
  const request = encode({
    identities: [Buffer.from("client")],
    header: makeHeader("kernel_info_request", "client-session"),
  }, connection.key, connection.signature_scheme)

  await kernel.handle(socket, request)

  assert.deepEqual(published, [
    ["status", { execution_state: "busy" }],
    ["status", { execution_state: "idle" }],
  ])
})
