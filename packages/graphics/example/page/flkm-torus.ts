import type { MatraElm } from "../../module.js"
import { circle, fill, setCanvasSize, strokeStyle, strokeWeight, svgLayout } from "../../module.js"
import { calculate, polarOffset } from "../math.js"

const cvsSize = 256
const [cvsW, cvsH] = [cvsSize, cvsSize]
const outerR = 89
const outerRIn = 13

setCanvasSize(cvsW, cvsH)

strokeWeight(13)

const flkmArr = [
  { name: "F", col: "green" },
  { name: "L", col: "red" },
  { name: "K", col: "yellow" },
  { name: "M", col: "blue" },
]

const torusCircleElmArr: MatraElm[] = []

Array.from({ length: 3 }).forEach((_, j) => {
  const [dx, dy] = polarOffset(outerRIn, j, 3, -0.5)

  fill("none")
  strokeStyle(flkmArr[calculate("Subtract(Power(2, j), 1)", { j })].col)

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, outerR)

  torusCircleElmArr.push(circleElm)
})

Array.from({ length: 1 }).forEach(_ => {
  fill("none")
  strokeStyle(flkmArr[2].col)

  const circleElm = circle(cvsW / 2, cvsH / 2, outerR)

  torusCircleElmArr.push(circleElm)
})

const matraElmArr = [...torusCircleElmArr]

export default svgLayout(matraElmArr, cvsW, cvsH)
