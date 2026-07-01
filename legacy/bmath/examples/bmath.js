const numI = {
    type: "const",
    value: "i",
}
const numE = {
    type: "const",
    value: "e",
}
const numT = {
    type: "const",
    value: "t",
}

class BNumber {
    constructor(...argArr) {
        if (argArr == null) {
        } else if (argArr.length === 0) {
        } else if (argArr.length === 1) {
            const [arg] = argArr

            if (arg == null) {
            } else if (typeof arg === "string") {
                const str = arg

                if (str === "0") {
                    this.type = "const"
                    this.value = "0"
                } else if (str.match(/^[0-9]$/)) {
                    this.type = "const"
                    this.value = str
                } else if (str.match(/^[0-9]+$/)) {
                    const val = Object.fromEntries(str.split("").reverse().entries())

                    this.type = "poly"
                    this.value = val
                }
            } else if (typeof arg === "boolean") {
            } else if (typeof arg === "number") {
                const num = arg
            } else if (typeof arg === "bigint") {
            } else if (typeof arg === "object") {
                if (arg instanceof Array) {
                    const arr = arg
                } else {
                    const obj = arg

                    this.value = obj
                }
            }
        } else if (argArr.length > 1) {
        }
    }

    plus(arg) {
        if (arg instanceof BNumber) {
            return new BNumber({ plusArr: [this, arg] })
        } else {
            return this
        }
    }

    times(arg) {
        if (arg instanceof BNumber) {
            return new BNumber({ timesArr: [this, arg] })
        } else {
            return this
        }
    }

    toString() {
        return JSON.stringify(this.value)
    }

    valueOf() {
        return this.value
    }
}

const bMath = {
    // arrayQ: undefined,
    // sameQ: undefined,
    // first: undefined,
    // last: undefined,
    // rest: undefined,
    // most: undefined,
    // take: undefined,
    // drop: undefined,
    // constantArray: undefined,
    // cloneArray: undefined,
    // range: undefined,
    // table: undefined,
    // append: undefined,
    // prepend: undefined,
    // insert: undefined,
    // delete: undefined,
    // appendTo: undefined,
    // prependTo: undefined,
    // position: undefined,
    // length: undefined,
    // dimensions: undefined,
    // select: undefined,
    // cases: undefined,
    // pick: undefined,
    // binLists: undefined,
    // flatten: undefined,
    // arrayFlatten: undefined,
    // join: undefined,
    // union: undefined,
    // deleteDuplicates: undefined,
    // total: undefined,
    // accumulate: undefined,
    // differences: undefined,
    // max: undefined,
    // min: undefined,
    // mean: undefined,
    // sort: undefined,
    // riffle: undefined,
    // padRight: undefined,
    // padLeft: undefined,
    // rotateRight: undefined,
    // rotateLeft: undefined,
    // transpose: undefined,
    // map: undefined,
    // mapAll: undefined,
    // fourier: undefined,
    // permutations: undefined,
    // randomSample: undefined,
    // tuples: undefined,
    // reverse: undefined,
    // outer: undefined,
    // distribute: undefined,
    I: numI,
    E: numE,
    T: numT,
    BNumber,
}

export default bMath