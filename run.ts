import { spawnSync } from "node:child_process";

export function run(cmd: string, check = true) {
    console.log(cmd);
    const result = spawnSync(cmd, { shell: true, stdio: "inherit", env: process.env });
    if (check && result.status !== 0) {
        throw new Error("Command failed: " + cmd);
    }
}

// stdout is piped, not inherited, so a captured secret value never reaches the log
export function capture(cmd: string): string {
    console.log(cmd);
    const result = spawnSync(cmd, { shell: true, stdio: ["inherit", "pipe", "inherit"], env: process.env });
    if (result.status !== 0) {
        throw new Error("Command failed: " + cmd);
    }
    return result.stdout.toString().trim();
}
