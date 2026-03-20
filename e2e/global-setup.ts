import path from "path";
import { config as loadEnv } from "dotenv";
import { spawn, type SpawnOptions } from "child_process";
import { once } from "events";
import { setTimeout as delay } from "timers/promises";

const rootDir = path.resolve(__dirname, "..");
loadEnv({ path: path.join(rootDir, ".env.test") });

const requiredEnv = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is required for E2E tests`);
  }
}

const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "production",
};

function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function waitForServerReady(baseUrl: string) {
  const probeUrl = new URL("/api/orgs", baseUrl).toString();
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(probeUrl);
      if (response.status === 200 || response.status === 401) {
        return;
      }
    } catch {
      // ignore until server is ready
    }
    await delay(500);
  }

  throw new Error(`Server did not become ready at ${probeUrl}`);
}

export default async function globalSetup() {
  await runCommand("npx", ["prisma", "db", "push", "--force-reset"], {
    cwd: rootDir,
    env: baseEnv,
  });

  await runCommand("npx", ["prisma", "generate"], {
    cwd: rootDir,
    env: baseEnv,
  });

  await runCommand("npm", ["run", "build"], {
    cwd: rootDir,
    env: baseEnv,
  });

  const server = spawn("npm", ["run", "start"], {
    cwd: rootDir,
    env: baseEnv,
    stdio: "inherit",
  });

  await waitForServerReady(baseEnv.AUTH_URL ?? "http://localhost:3000");

  return async () => {
    if (!server.pid) return;

    server.kill("SIGTERM");
    const timeout = setTimeout(() => {
      server.kill("SIGKILL");
    }, 5000);

    await once(server, "exit");
    clearTimeout(timeout);
  };
}
