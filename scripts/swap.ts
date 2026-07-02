#!/usr/bin/env bun

import { run } from "../run";

const swapSizeMb = 2048;

run(`sudo fallocate -l ${swapSizeMb}M /swapfile`);
run("sudo chmod 600 /swapfile");
run("sudo mkswap /swapfile");
run("sudo swapon /swapfile");

run("echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab");

console.log("Swap space of " + swapSizeMb + "M has been added:");
run("free -h");
run("swapon --show");
