import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 12));
