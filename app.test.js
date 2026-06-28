const assert = require("node:assert/strict");
const { normalizeUrl, diffUrls } = require("./app.js");

function key(raw) {
  const result = normalizeUrl(raw);
  assert.equal(result.status, "ok");
  return result.key;
}

assert.equal(key("https://www.Example.com/"), "example.com/");
assert.equal(key("Example.com"), "example.com/");
assert.equal(key("www.example.com/page/"), "example.com/page");
assert.equal(key("example.com:8080/page/"), "example.com:8080/page");
assert.equal(key("www.example.com:8080/page/"), "example.com:8080/page");
assert.equal(key("example.com:443/page/"), "example.com/page");
assert.equal(key("example.com/page?a=1#part"), "example.com/page?a=1#part");
assert.equal(key("http://example.com/page/"), "example.com/page");
assert.equal(key("https://example.com/page?a=1"), "example.com/page?a=1");
assert.equal(key("https://example.com/page?a=1#part"), "example.com/page?a=1#part");
assert.equal(key("http://www.example.com:80/page/"), "example.com/page");
assert.equal(key("https://example.com:443/page/"), "example.com/page");
assert.equal(key("https://example.com:8080/page/"), "example.com:8080/page");
assert.equal(normalizeUrl("   ").status, "empty");
assert.equal(normalizeUrl("not a url").status, "invalid");
assert.equal(normalizeUrl("ftp://example.com").status, "invalid");

const inputA = [
  "https://example.com/",
  "http://www.example.com/page/",
  "https://blog.example.com/post",
  "https://example.com/page?a=1",
  "https://example.com/page?a=1",
  "bad-url",
].join("\n");

const inputB = [
  "http://example.com",
  "https://example.com/page",
  "https://blog.example.com/post/",
  "https://example.com/page?a=2",
  "",
].join("\n");

assert.deepEqual(diffUrls(inputA, inputB), {
  uniqueA: ["https://example.com/page?a=1"],
  uniqueB: ["https://example.com/page?a=2"],
  common: [
    "https://example.com/",
    "http://www.example.com/page/",
    "https://blog.example.com/post",
  ],
  invalidA: ["bad-url"],
  invalidB: [],
});

assert.deepEqual(diffUrls("example.com\nwww.example.com/page", "https://www.example.com/\nhttp://example.com/page/"), {
  uniqueA: [],
  uniqueB: [],
  common: ["example.com", "www.example.com/page"],
  invalidA: [],
  invalidB: [],
});

assert.deepEqual(diffUrls("example.com:8080/tools/\nexample.com?a=1", "http://example.com:8080/tools\nhttps://example.com?a=2"), {
  uniqueA: ["example.com?a=1"],
  uniqueB: ["https://example.com?a=2"],
  common: ["example.com:8080/tools/"],
  invalidA: [],
  invalidB: [],
});

console.log("All URL diff tests passed.");
