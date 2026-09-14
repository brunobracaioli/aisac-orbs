import { spawn } from "node:child_process";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const reuseBuild = process.env.ORB_E2E_REUSE_BUILD === "1";
const environment = {
  NODE_ENV: "production",
  NEXT_PUBLIC_ORB_SEED: "1",
  ORB_SMOKE_ROUTES: "1",
  ORB_E2E_REUSE_BUILD: reuseBuild ? "1" : "0",
  PATH: process.env.PATH ?? "",
};

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, args, {
      env: environment,
      stdio: "inherit",
    });

    const stopChild = () => child.kill("SIGTERM");
    process.once("SIGINT", stopChild);
    process.once("SIGTERM", stopChild);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", stopChild);
      process.removeListener("SIGTERM", stopChild);
      if (signal !== null) {
        reject(new Error(`pnpm ${args[0]} exited with signal ${signal}`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pnpm ${args[0]} exited with code ${code ?? "unknown"}`));
      }
    });
  });
}

if (!reuseBuild) {
  await run(["build"]);
}
await run(["start"]);
