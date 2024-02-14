var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var memory_cache_exports = {};
__export(memory_cache_exports, {
  default: () => MemoryCache,
  format: () => format
});
module.exports = __toCommonJS(memory_cache_exports);
var import_node_events = require("node:events");
function format(time) {
  let result = 0;
  const keys = ["s", "sec", "second", "m", "min", "minute", "h", "hr", "hour"];
  const exist = keys.some((key) => time.endsWith(key));
  const param = keys.find((key) => time.endsWith(key));
  if (!exist || !param)
    return result;
  const number = parseFloat(time.substring(0, time.length - param.length));
  switch (param) {
    case "s":
    case "sec":
    case "second":
      result = number;
      break;
    case "m":
    case "min":
    case "minute":
      result = number * 60;
      break;
    case "h":
    case "hr":
    case "hour":
      result = number * 3600;
      break;
    default:
      result = 0;
      break;
  }
  return result;
}
var MemoryCache = class extends import_node_events.EventEmitter {
  $cache;
  $hitCount;
  $missCount;
  $size;
  $debug;
  ttl;
  constructor({ ttl }) {
    super();
    this.$cache = /* @__PURE__ */ new Map();
    this.$hitCount = 0;
    this.$missCount = 0;
    this.$size = 0;
    this.$debug = false;
    this.ttl = ttl;
  }
  $del(key) {
    this.$size--;
    this.$cache.delete(key);
  }
  keys() {
    return this.$cache.keys();
  }
  has(key) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key);
      if (this.$debug) {
        console.debug(record);
      }
      if (isNaN(record.expire) || record.expire >= Date.now()) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  get(key) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key);
      if (isNaN(record.expire) || record.expire >= Date.now()) {
        if (this.$debug) {
          this.$hitCount++;
        }
        return record.value;
      } else {
        if (this.$debug) {
          this.$missCount++;
        }
        this.$size--;
        this.$cache.delete(key);
      }
    } else if (this.$debug) {
      this.$missCount++;
    }
    return null;
  }
  put({ key, value, callback }) {
    const t = typeof this.ttl === "string" ? format(this.ttl || "10sec") : this.ttl;
    if (this.$debug) {
      console.debug(
        `caching: ${key} => ${value} (${this.ttl}${typeof this.ttl === "string" ? "" : "ms"})`
      );
    }
    if (typeof t !== "undefined" && (typeof t !== "number" || isNaN(t) || t <= 0)) {
      throw new Error("Cache timeout must be a positive number");
    } else if (typeof callback !== "undefined" && typeof callback !== "function") {
      throw new Error("Cache timeout callback must be a function");
    }
    if (this.$cache.has(key)) {
      const oldRecord = this.$cache.get(key);
      clearTimeout(oldRecord.timeout);
    } else {
      this.$size++;
    }
    const record = {
      value,
      expire: (t || 0) + Date.now(),
      timeout: setTimeout(() => {
      }, 0)
    };
    if (!isNaN(record.expire)) {
      record.timeout = setTimeout(() => {
        this.$del(key);
        if (callback) {
          callback(key, value);
        }
      }, t);
    }
    this.$cache.set(key, record);
    this.emit("put", key, value);
    return value;
  }
  del(key) {
    let canDelete = true;
    if (this.$cache.has(key)) {
      const oldRecord = this.$cache.get(key);
      clearTimeout(oldRecord.timeout);
      if (!isNaN(oldRecord.expire) || oldRecord.expire < Date.now()) {
        canDelete = false;
      }
    } else {
      canDelete = false;
    }
    if (canDelete) {
      this.$del(key);
      this.emit("del", key);
    }
    return canDelete;
  }
  clear() {
    for (const [i] of this.$cache) {
      clearTimeout(this.$cache.get(i)?.timeout);
    }
    this.$size = 0;
    this.$cache = /* @__PURE__ */ new Map();
    this.emit("clear");
    if (this.$debug) {
      this.$hitCount = 0;
      this.$missCount = 0;
    }
  }
  size() {
    return this.$size;
  }
  memsize() {
    let size = 0;
    for (const [] of this.$cache) {
      size++;
    }
    return size;
  }
  debug(bool) {
    this.$debug = bool;
  }
  hits() {
    return this.$hitCount;
  }
  expired(key, second) {
    if (this.$cache.has(key)) {
      const record = this.$cache.get(key);
      this.emit("expire", key, true);
      return (Date.now() - record.expire) / 1e3 >= second;
    } else {
      this.emit("expire", key, false);
      return false;
    }
  }
  misses() {
    return this.$missCount;
  }
  export() {
    const plainJSCache = /* @__PURE__ */ new Map();
    for (const [key] of this.$cache) {
      const record = this.$cache.get(key);
      plainJSCache.set(key, {
        value: record?.value,
        // @ts-expect-error JSON doesn't support NaN, so convert it to 'NaN'.
        expire: record?.expire || "NaN"
      });
    }
    this.emit("export", JSON.stringify(plainJSCache));
    return JSON.stringify(plainJSCache);
  }
  import(jsonToImport, options) {
    const cacheToImport = JSON.parse(jsonToImport);
    const currTime = Date.now();
    const skipDuplicates = options && options.skipDuplicates;
    for (const [key] of cacheToImport) {
      if (skipDuplicates) {
        if (this.$cache.has(key)) {
          if (this.$debug) {
            console.debug(`Skipping duplicate imported key '${key}'`);
          }
          continue;
        }
      }
      if (!cacheToImport.has(key)) {
        throw new Error("No cache record found when trying to import!");
      }
      const record = cacheToImport.get(key);
      let remainingTime = record.expire - currTime;
      if (remainingTime <= 0) {
        this.$del(key);
        continue;
      }
      remainingTime = remainingTime > 0 ? remainingTime : void 0;
      this.ttl = remainingTime || this.ttl;
      this.put({ key, value: record?.value });
    }
    this.emit("import", this.size());
    return this.size();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  format
});
