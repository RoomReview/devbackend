#!/usr/bin/env node
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// Load env from project root
dotenv.config({ path: new URL('../.env', import.meta.url) });

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args[key] = val;
  }
}

const sub = args.sub || args.user || 'test-user-id';
const email = args.email || 'devs@roomreview.co.uk';
const role = args.role || 'TENANT';
const type = (args.type || 'access').toLowerCase();

const cfg = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
  issuer: process.env.JWT_ISSUER || 'roomreview-api',
  accessAudience: process.env.JWT_ACCESS_TOKEN_AUDIENCE || 'roomreview-client',
  refreshAudience: process.env.JWT_REFRESH_TOKEN_AUDIENCE || 'roomreview-auth',
};

const payload = { sub, email, role };

const opts = {
  jwtid: crypto.randomUUID(),
  issuer: cfg.issuer,
  audience: type === 'refresh' ? cfg.refreshAudience : cfg.accessAudience,
  expiresIn: type === 'refresh' ? cfg.jwtRefreshExpiresIn : cfg.jwtExpiresIn,
};

const secret = type === 'refresh' ? cfg.jwtRefreshSecret : cfg.jwtSecret;

try {
  const token = jwt.sign(payload, secret, opts);
  const decoded = jwt.decode(token) || {};
  const exp = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'n/a';

  console.log('=== JWT Token Generated ===');
  console.log('type:', type);
  console.log('sub:', sub);
  console.log('email:', email);
  console.log('role:', role);
  console.log('jwtid:', opts.jwtid);
  console.log('expiresAt:', exp);
  console.log('\nToken:\n');
  console.log(token);
  console.log('===========================');
} catch (err) {
  console.error('Failed to generate token:', err.message ?? err);
  process.exit(1);
}
