import { createHmac, randomUUID } from "node:crypto"

export const DELIMITER = "<IDS|MSG>"

export function makeHeader(msgType, session, username = "kernel") {
  return {
    msg_id: randomUUID(), username, session, date: new Date().toISOString(),
    msg_type: msgType, version: "5.3",
  }
}

export function decode(frames, key = "", scheme = "hmac-sha256") {
  const delimiter = frames.findIndex(frame => frame.toString() === DELIMITER)
  if (delimiter < 0 || frames.length < delimiter + 6) throw new Error("Invalid Jupyter message")
  const identities = frames.slice(0, delimiter)
  const [signature, ...jsonFrames] = frames.slice(delimiter + 1, delimiter + 6)
  const expected = sign(jsonFrames, key, scheme)
  if (key && signature.toString() !== expected) throw new Error("Invalid Jupyter message signature")
  const [header, parentHeader, metadata, content] = jsonFrames.slice(0, 4).map(frame => JSON.parse(frame.toString()))
  return { identities, header, parentHeader, metadata, content, buffers: frames.slice(delimiter + 6) }
}

export function encode({ identities = [], header, parentHeader = {}, metadata = {}, content = {}, buffers = [] }, key = "", scheme = "hmac-sha256") {
  const jsonFrames = [header, parentHeader, metadata, content].map(value => Buffer.from(JSON.stringify(value)))
  return [...identities, Buffer.from(DELIMITER), Buffer.from(sign(jsonFrames, key, scheme)), ...jsonFrames, ...buffers]
}

function sign(frames, key, scheme) {
  if (!key) return ""
  const algorithm = scheme.replace(/^hmac-/, "")
  const hmac = createHmac(algorithm, key)
  for (const frame of frames) hmac.update(frame)
  return hmac.digest("hex")
}
