import { executeMatraProgram } from "../matra-program"

self.addEventListener("message", event => {
  const { id, program } = event.data as { id: number, program: string }
  try {
    self.postMessage({ id, source: executeMatraProgram(program) })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
})
