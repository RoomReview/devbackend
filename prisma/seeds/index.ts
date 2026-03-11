import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsPath = path.join(__dirname, "../seeds");
const options = {
    environment: { type: "string", default: "development" },
    seed: { type: "string", multiple: true },
} as const;

const { values, positionals } = parseArgs({
    options,
    strict: true,
});

if (!values.seed?.length) {
    console.error('\nnothing to seed, pass --seed <seed-file> to seed\n');
    process.exit(1)
}

const seeds = values.seed;
const promiseArr = []

for (let index = 0; index < seeds.length; index++) {
    const element = seeds[index];
    const pathData = path.relative(__dirname, element)
    promiseArr.push(import(`./${pathData}`));
}

await Promise.all(promiseArr)