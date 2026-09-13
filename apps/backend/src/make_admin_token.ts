import { createAccessToken } from "./auth/jwt";
async function run() {
  const token = await createAccessToken({ id: 12, role: "ADMIN" });
  console.log(token);
}
run();
