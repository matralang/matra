const replacer = (_key: string, value: unknown) => {
  if (typeof value === "bigint") {
    return value.toString();
  } else if (value instanceof Map) {
    const arr: unknown[] = [];
    for (const [k, v] of value) {
      arr.push([typeof k === "string" ? JSON.parse(k) : k, v]);
    }
    return arr;
  } else {
    return value;
  }
};

export { replacer };