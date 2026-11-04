import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessAdminDashboard,
  canAccessAdminPermission,
  canViewAdminAuditLog,
} from './admin-access';

describe('account-specific administrator access', () => {
  it('grants the main developer full admin access', () => {
    const email = 'ROOMREVIEVSUPERPUPERADMIN@roomreview.co.uk';
    assert.strictEqual(canAccessAdminDashboard(email, 'ADMIN'), true);
    assert.strictEqual(canViewAdminAuditLog(email, 'ADMIN'), true);
    assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'manage:users'), true);
  });

  it('grants Federico and Yuliia admin access except the activity log', () => {
    for (const email of ['federico@roomreview.co.uk', 'Yuliia@roomreview.co.uk']) {
      assert.strictEqual(canAccessAdminDashboard(email, 'ADMIN'), true);
      assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'manage:reviews'), true);
      assert.strictEqual(canViewAdminAuditLog(email, 'ADMIN'), false);
    }
  });

  it('limits Megha to creating and publishing blog posts', () => {
    const email = 'MeghaMayuri@roomreview.co.uk';
    assert.strictEqual(canAccessAdminDashboard(email, 'ADMIN'), false);
    assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'create:blog'), true);
    assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'publish:blog'), true);
    assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'manage:blog'), false);
    assert.strictEqual(canAccessAdminPermission(email, 'ADMIN', 'manage:users'), false);
  });

  it('does not grant admin access to unlisted addresses or non-admin accounts', () => {
    assert.strictEqual(canAccessAdminDashboard('other@roomreview.co.uk', 'ADMIN'), false);
    assert.strictEqual(canAccessAdminPermission('meghamayuri@roomreview.co.uk', 'TENANT', 'create:blog'), false);
  });
});
