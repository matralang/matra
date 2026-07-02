import assert from "node:assert/strict"
import test from "node:test"
import { decode, encode, makeHeader } from "../src/message.js"

test("round-trips signed Jupyter wire messages", () => {
  const message = {
    identities: [Buffer.from("client")], header: makeHeader("kernel_info_request", "session"),
    parentHeader: {}, metadata: {}, content: { hello: "world" },
  }
  const decoded = decode(encode(message, "secret"), "secret")
  assert.equal(decoded.identities[0].toString(), "client")
  assert.deepEqual(decoded.content, { hello: "world" })
})

test("rejects a bad signature", () => {
  const frames = encode({ header: makeHeader("x", "s") }, "secret")
  assert.throws(() => decode(frames, "wrong"), /signature/)
})
