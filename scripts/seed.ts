import { parseArgs } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import readline from "node:readline/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsPath = path.join(__dirname, "../prisma/seeds");

async function runSeed(args: string[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const seedProcess = spawn("npx", ["prisma", "db", "seed", "--", ...args], {
            stdio: "inherit",
            shell: true,
        });

        seedProcess.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Seed exited with code ${code}`));
            }
        });

        seedProcess.on("error", (err) => {
            reject(err);
        });
    });
}

async function main() {
    const files = await fs.readdir(seedsPath);
    const availableSeeds = files
        .filter((f) => f.endsWith(".ts") && f !== "index.ts")
        .map((f) => f.replace(".ts", ""));

    const options = {
        environment: { type: "string", default: "development" },
        seed: { type: "string", multiple: true },
    } as const;

    const { values, positionals } = parseArgs({
        options,
        strict: true,
    });

    const seedsToRun: string[] = (values.seed as string[]) || [];

    for (const pos of positionals) {
        if (availableSeeds.includes(pos) && !seedsToRun.includes(pos)) {
            seedsToRun.push(pos);
        }
    }

    if (seedsToRun.length === 0) {
        console.log("No seed files specified via arguments.");
        console.log("Available seeds:\n");

        availableSeeds.forEach((seed, index) => {
            console.log(`  ${index + 1}) ${seed}`);
        });

        console.log(`  0) Cancel`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await rl.question(
            "\nEnter the number(s) of the seed(s) you want to run (comma separated) or 0 to cancel: "
        );
        rl.close();

        const selections = answer
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        console.log('selections', selections)
        for (const sel of selections) {
            const index = parseInt(sel, 10);
            if (index === 0) {
                console.log("Operation cancelled.");
                process.exit(0);
            }
            if (index > 0 && index <= availableSeeds.length) {
                seedsToRun.push(availableSeeds[index - 1]);
            } else {
                console.error(`Invalid selection: ${sel}`);
                process.exit(1);
            }
        }

        if (seedsToRun.length === 0) {
            console.log("No valid seeds selected. Exiting.");
            process.exit(0);
        }
    }

    // Forward the environment argument to the child process
    const forwardedArgs: string[] = [];
    if (values.environment) {
        forwardedArgs.push("--environment", values.environment as string);
    }
    const seedFiles = [];
    for (const seedFileName of seedsToRun) {
        console.log('sendFileName', seedFileName);
        console.log('availabelSeeds', availableSeeds);
        if (!availableSeeds.includes(seedFileName)) {
            console.error(
                `Error: Seed "${seedFileName}" not found. Available seeds: ${availableSeeds.join(", ")}`
            );
            process.exit(1);
        }
        const seedPath = path.join(__dirname, "../prisma/seeds", `${seedFileName}.ts`);
        seedFiles.push(seedPath)
    }
    forwardedArgs.push("--seed", seedFiles.join(',') as string);
    await runSeed(forwardedArgs);

    // for (const seedName of seedsToRun) {
    //     if (!availableSeeds.includes(seedName)) {
    //         console.error(
    //             `Error: Seed "${seedName}" not found. Available seeds: ${availableSeeds.join(", ")}`
    //         );
    //         process.exit(1);
    //     }

    //     console.log(`\n=========================================`);
    //     console.log(`Executing seed: ${seedName}`);
    //     console.log(`=========================================\n`);

    //     const seedPath = path.join(__dirname, "../prisma/seeds", `${seedName}.ts`);
    //     try {
    //         await runSeed(seedPath, forwardedArgs);
    //     } catch (error) {
    //         console.error(`\nFailed to execute seed: ${seedName}`);
    //         console.error(error);
    //         process.exit(1);
    //     }
    // }

    console.log(`\n=========================================`);
    console.log(`All selected seeds executed successfully!`);
    console.log(`=========================================\n`);
}

main().catch((e) => {
    console.error("Unhandled error during seed execution:", e);
    process.exit(1);
});
