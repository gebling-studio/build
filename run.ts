import { spawnSync } from "node:child_process";

export function run(cmd: string, check = true) {
    console.log(cmd);
    const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
    if (check && result.status !== 0) {
        throw new Error("Command failed: " + cmd);
    }
}
