import { db } from "./prisma/db";
async function run() {
  const admin = await db.orm.public.User.where({ role: "ADMIN" }).first();
  console.log(JSON.stringify(admin, null, 2));
}
run();
