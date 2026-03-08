import { parseArgs } from "node:util";

import prisma from "../../src/config/database.ts";
import { hashPassword } from "../../src/services/password.service.ts";
import logger, { type LogContext } from "../../src/utils/logger.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_NAME = "default-user";

const logCtx: LogContext = { service: "Seed", function: SEED_NAME };

const DEV_DEFAULTS = {
    email: "admin@roomreview.dev",
    password: "Admin@1234!",
    firstName: "Admin",
    lastName: "User",
};

// ─── CLI args ─────────────────────────────────────────────────────────────────

const options = {
    environment: { type: "string" },
} as const;

const {
    values: { environment },
} = parseArgs({ options, strict: false });

// ─── Credential resolution ────────────────────────────────────────────────────

function resolveCredentials(env: string | undefined): {
    email: string;
    password: string;
} {
    if (env === "production") {
        const email = process.env.DEFAULT_USER_EMAIL;
        const password = process.env.DEFAULT_USER_PASSWORD;

        if (!email || !password) {
            logger.error(
                logCtx,
                "DEFAULT_USER_EMAIL and DEFAULT_USER_PASSWORD must be set in production.",
            );
            process.exit(1);
        }

        return { email, password };
    }

    // development / test / staging — safe to use inline defaults
    logger.warn(
        logCtx,
        `Non-production environment "${env ?? "unknown"}". Using default seed credentials.`,
    );

    return { email: DEV_DEFAULTS.email, password: DEV_DEFAULTS.password };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    logger.info(logCtx, "Seeding default admin user.", { environment });
    if (typeof environment !== "string") {
        logger.error(logCtx, "Environment must be a string.");
        process.exit(1);
    }
    const { email, password } = resolveCredentials(environment);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        logger.info(logCtx, `Default admin user already exists.`, { email });
        return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            email,
            firstName: DEV_DEFAULTS.firstName,
            lastName: DEV_DEFAULTS.lastName,
            passwordHash,
            role: "ADMIN",
            isEmailVerified: true,
            verifiedAt: new Date(),
        },
        select: {
            userId: true,
            email: true,
            role: true,
        },
    });

    logger.info(logCtx, "Default admin user created successfully.", { user });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        logger.error(logCtx, "Seed failed.", { error: e });
        await prisma.$disconnect();
        process.exit(1);
    });

export default null