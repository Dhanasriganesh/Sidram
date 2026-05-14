import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8')

console.log(`
Sidram Khaata — Firestore rules

If the app shows "Missing or insufficient permissions", your Firebase project
does not have these rules published yet (the app cannot create collections
until at least one write is allowed).

Do this once:
  1. Open https://console.firebase.google.com/
  2. Select your project
  3. Firestore Database → tab "Rules"
  4. Replace the editor contents with everything between the lines below
  5. Click "Publish"

Then refresh the app and use "Save person" again.

---------- BEGIN RULES (copy from next line through END) ----------
`)
console.log(rules.trimEnd())
console.log(`
---------- END RULES ----------
`)
