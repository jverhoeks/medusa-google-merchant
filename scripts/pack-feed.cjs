// Ship the same compiled feed code without backend/admin runtime dependencies.
const { mkdirSync, copyFileSync, writeFileSync, readFileSync } = require("node:fs")
const { execFileSync } = require("node:child_process")
const { join, resolve } = require("node:path")
const root = process.cwd()
const pkg = JSON.parse(readFileSync("package.json"))
const directory = resolve(".medusa/feed")
mkdirSync(directory, {recursive:true})
for (const name of ["feed", "loader", "options"]) {
  for (const extension of ["js", "d.ts"]) copyFileSync(`.medusa/server/src/lib/${name}.${extension}`, join(directory,`${name}.${extension}`))
}
for (const name of ["README.md", "LICENSE"]) copyFileSync(name,join(directory,name))
writeFileSync(join(directory,"package.json"),JSON.stringify({
  name:"@jverhoeks/medusa-google-merchant-feed",version:pkg.version,
  description:"Headless Google Merchant feed generator for Medusa storefronts",
  license:pkg.license,author:pkg.author,repository:pkg.repository,
  engines:pkg.engines,files:["*.js","*.d.ts","README.md","LICENSE"],
  exports:{"./core":"./feed.js","./loader":"./loader.js","./options":"./options.js","./package.json":"./package.json"},
  peerDependencies:{"@medusajs/types":"2.21.2"},
  typesVersions:{"*":{"core":["feed.d.ts"],"loader":["loader.d.ts"],"options":["options.d.ts"]}},
},null,2)+"\n")
execFileSync("npm",["pack","--pack-destination",root],{cwd:directory,stdio:"inherit"})
