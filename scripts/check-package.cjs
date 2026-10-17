const { execFileSync } = require("node:child_process")
const { readdirSync } = require("node:fs")
const archive = readdirSync(".").find(name => name.endsWith(".tgz"))
if (!archive) throw new Error("Missing package archive")
const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
for (const path of ["src/api/google-merchant.xml/route.js", "src/modules/google-merchant/index.js", "src/admin/index.mjs", "src/admin/index.js"]) {
  if (!files.includes(`package/.medusa/server/${path}`)) throw new Error(`Missing compiled ${path}`)
}
if (/node_modules\/|\.env(?:\n|\.)|\.git\//.test(files)) throw new Error("Unexpected private/generated package content")
console.log("Compiled plugin routes, module and admin extensions packaged; no environment or dependency files")
