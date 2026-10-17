const { execFileSync } = require("node:child_process")
const { readFileSync } = require("node:fs")
const { version } = JSON.parse(readFileSync("package.json"))
for (const feedOnly of [false,true]) {
  const archive = `jverhoeks-medusa-google-merchant${feedOnly ? "-feed" : ""}-${version}.tgz`
  const files = execFileSync("tar",["-tzf",archive],{encoding:"utf8"})
  const expected = feedOnly ? ["feed.js","loader.js","options.js","feed.d.ts"] : [
    ".medusa/server/src/api/google-merchant.xml/route.js",
    ".medusa/server/src/modules/google-merchant/index.js",
    ".medusa/server/src/admin/index.mjs", ".medusa/server/src/admin/index.js",
  ]
  for (const path of expected) if (!files.includes(`package/${path}`)) throw new Error(`Missing compiled ${path}`)
  if (/node_modules\/|\.env(?:\n|\.)|\.git\//.test(files)) throw new Error("Unexpected package content")
  if (feedOnly) {
    const pkg = JSON.parse(execFileSync("tar",["-xOf",archive,"package/package.json"],{encoding:"utf8"}))
    if (Object.keys(pkg.peerDependencies).some(key => key !== "@medusajs/types")) throw new Error("Feed package must not depend on admin/backend runtimes")
  }
}
console.log("Plugin and feed-only archives verified; admin/runtime dependencies excluded from storefront package")
