// Integration fixture only. Never use an application/customer database.
const { mkdtempSync, writeFileSync, symlinkSync, mkdirSync, readdirSync, readFileSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { join, resolve } = require("node:path")
const { spawn, execFileSync } = require("node:child_process")
const assert = require("node:assert/strict")
const database = new URL(process.env.MERCHANT_TEST_DATABASE_URL || "postgres://postgres:fixture_only@localhost:5432/merchant_plugin_test?sslmode=disable")
assert(["localhost", "127.0.0.1", "[::1]", "boticadoro-usage-postgres"].includes(database.hostname), "Use an isolated local database host")
assert(/^\/merchant_plugin_[a-z0-9_]+$/.test(database.pathname), "Database name must start merchant_plugin_")
const root = process.cwd()
const archive = readdirSync(root).find(name => name.endsWith(".tgz"))
assert(archive, "Run npm pack first")
const installed = join(root, "node_modules/@jverhoeks/medusa-google-merchant")
mkdirSync(installed, { recursive: true })
execFileSync("tar", ["-xzf", join(root, archive), "-C", installed, "--strip-components=1"])
const fixture = mkdtempSync(join(tmpdir(), "merchant-plugin-"))
symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir")
writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "merchant-plugin-fixture", version: "0.0.0", dependencies: { "@medusajs/medusa": "2.21.2" } }))
writeFileSync(join(fixture, "tsconfig.json"), readFileSync(join(root, "tsconfig.json")))
mkdirSync(join(fixture, "src"))
writeFileSync(join(fixture, "medusa-config.ts"), `
import { defineConfig } from "@medusajs/framework/utils"
module.exports = defineConfig({
  admin: { disable: true },
  projectConfig: {
    databaseUrl: process.env.MERCHANT_TEST_DATABASE_URL,
    http: { storeCors: "http://localhost:9000", adminCors: "http://localhost:9000", authCors: "http://localhost:9000", jwtSecret: "merchant_fixture_only", cookieSecret: "merchant_fixture_only" },
  },
  plugins: [{ resolve: "@jverhoeks/medusa-google-merchant", options: {
    externalFeed: process.env.MERCHANT_FIXTURE_EXTERNAL === "true",
    enabled: true, storefrontUrl: "https://shop.example", backendUrl: "http://localhost:9000",
    publishableKey: process.env.MERCHANT_FIXTURE_KEY || "pk_fixture_pending", title: "Fixture Shop",
  } }],
})
`)
const env = { ...process.env, MERCHANT_TEST_DATABASE_URL: database.href, MEDUSA_DISABLE_TELEMETRY: "true", NODE_ENV: "development" }
const cli = require.resolve("@medusajs/cli/cli.js")
const run = args => {
  try { return execFileSync(process.execPath, [cli, ...args], { cwd: fixture, env, stdio: "pipe", timeout: 180000 }) }
  catch (error) { throw new Error(`Fixture ${args[0]} failed: ${String(error.stdout || "").slice(-6000)} ${String(error.stderr || "").slice(-2000)}`) }
}
let server
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function boot() {
  server = spawn(process.execPath, [cli, "develop"], { cwd: fixture, env, detached: true, stdio: ["ignore", "pipe", "pipe"] })
  // Keep fixture logs private; report a bounded diagnostic only on failure.
  let log = ""
  for (const stream of [server.stdout, server.stderr]) stream.on("data", b => { log = (log + b).slice(-8000) })
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch("http://localhost:9000/health")).ok) return } catch {}
    if (server.exitCode !== null) throw new Error(`Fixture exited: ${log}`)
    await delay(1000)
  }
  throw new Error(`Fixture not ready: ${log}`)
}
async function stop() {
  if (server && server.exitCode === null) {
    const child = server
    const stopped = new Promise(resolve => child.once("exit", resolve))
    process.kill(-child.pid, "SIGTERM")
    await Promise.race([stopped, delay(5000)])
    if (child.exitCode === null) process.kill(-child.pid, "SIGKILL")
  }
  server = null
}
let token
async function api(path, body, auth = true) {
  const response = await fetch(`http://localhost:9000${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const value = await response.text()
  assert(response.ok, `${path}: ${response.status} ${value.slice(0,300)}`)
  return JSON.parse(value)
}
async function main() {
  run(["db:migrate"])
  run(["user", "--email", "merchant-admin@example.test", "--password", "MerchantFixture123!"])
  await boot()
  for (const [path, method] of [["/admin/google-merchant", "GET"], ["/admin/google-merchant/products/prod_fake", "POST"]]) {
    const r = await fetch(`http://localhost:9000${path}`, { method, headers: {"Content-Type":"application/json"}, ...(method === "POST" ? {body:JSON.stringify({enabled:true})} : {}) })
    assert.equal(r.status,401, "Admin routes must require authentication")
  }
  token = (await api("/auth/user/emailpass", { email: "merchant-admin@example.test", password: "MerchantFixture123!" }, false)).token
  const settings = await api("/admin/google-merchant")
  assert.equal(settings.selection_mode,"opt-in")
  const { sales_channel } = await api("/admin/sales-channels", {name:"Merchant fixture"})
  const { api_key } = await api("/admin/api-keys", {title:"Merchant fixture",type:"publishable"})
  await api(`/admin/api-keys/${api_key.id}/sales-channels`, {add:[sales_channel.id]})
  await api("/admin/regions", {name:"Netherlands",currency_code:"eur",countries:["nl"]})
  const { product } = await api("/admin/products", {
    title:"Fixture product",handle:"fixture-product",status:"published",description:"Synthetic merchant product",
    thumbnail:"https://shop.example/image.jpg",metadata:{fixture_other:"preserved"},
    options:[{title:"Default",values:["Default"]}],sales_channels:[{id:sales_channel.id}],
    variants:[{title:"Default",manage_inventory:false,options:{Default:"Default"},prices:[{currency_code:"eur",amount:10}]}],
  })
  env.MERCHANT_FIXTURE_KEY = api_key.token
  await stop()
  await boot()
  const feed = async () => {
    const r = await fetch("http://localhost:9000/google-merchant.xml")
    assert.equal(r.status,200)
    assert.match(r.headers.get("content-type"),/application\/xml/)
    assert.equal(r.headers.get("cache-control"),"no-store")
    return r.text()
  }
  assert.doesNotMatch(await feed(),/<item>/)
  const invalid = await fetch(`http://localhost:9000/admin/google-merchant/products/${product.id}`, {
    method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({enabled:"true"}),
  })
  assert.equal(invalid.status,400)
  await api(`/admin/google-merchant/products/${product.id}`,{enabled:true})
  assert.match(await feed(),/<item>/)
  const after = (await api(`/admin/products/${product.id}`)).product
  assert.equal(after.metadata.fixture_other,"preserved")
  assert.equal(after.metadata.google_merchant_enabled,true)
  assert.equal(after.status,"published")
  await api(`/admin/google-merchant/products/${product.id}`,{enabled:false})
  assert.doesNotMatch(await feed(),/<item>/)
  env.MERCHANT_FIXTURE_EXTERNAL = "true"
  await stop()
  await boot()
  const external = await api("/admin/google-merchant")
  assert.equal(external.enabled, null)
  assert.equal(external.feed_managed_externally, true)
  assert.equal(external.feed_url, "https://shop.example/google-merchant.xml")
  assert.equal((await fetch("http://localhost:9000/google-merchant.xml")).status,404)
  console.log("Packaged plugin loaded; external storefront settings verified; admin auth enforced; real product enable/disable changes XML; other metadata preserved")
}
main().catch(error => { console.error(error.message);process.exitCode=1 }).finally(stop)
