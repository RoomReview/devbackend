import assert from 'node:assert';
import { describe, it } from 'node:test';
import { EarlyAccessRegisterDto, RegisterUserDto } from '../dto/auth.dto';
import { UserRole } from '../generated/prisma/enums';

describe('RegisterUserDto Validation', () => {
  it('should validate successfully for TENANT role without agency fields', () => {
    const data = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.TENANT,
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, true);
  });

  it('should validate successfully for LANDLORD role without agency fields', () => {
    const result = RegisterUserDto.safeParse({
      email: 'landlord@example.com',
      password: 'password123',
      firstName: 'Alex',
      lastName: 'Taylor',
      role: UserRole.LANDLORD,
    });
    assert.strictEqual(result.success, true);
  });

  describe('EarlyAccessRegisterDto Validation', () => {
    const validData = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: UserRole.AGENCY,
      agencyName: 'Example Agency',
      agencyPhone: '+442012345678',
    };

    it('accepts agency early access registrations with company and phone details', () => {
      assert.strictEqual(EarlyAccessRegisterDto.safeParse(validData).success, true);
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, role: UserRole.AGENT }).success,
        true,
      );
    });

    it('requires company and phone details for early access', () => {
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, agencyName: ' ' }).success,
        false,
      );
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, agencyPhone: ' ' }).success,
        false,
      );
    });

    it('rejects passwords shorter than eight characters', () => {
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, password: 'short' }).success,
        false,
      );
    });

    it('rejects blank names and malformed email addresses', () => {
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, firstName: '  ' }).success,
        false,
      );
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, email: 'not-an-email' }).success,
        false,
      );
    });

    it('rejects early access registrations for non-agency roles', () => {
      assert.strictEqual(
        EarlyAccessRegisterDto.safeParse({ ...validData, role: UserRole.TENANT }).success,
        false,
      );
    });
  });

  it('should fail validation for AGENCY role without agencyName', () => {
    const data = {
      email: 'agency@example.com',
      password: 'password123',
      firstName: 'Agency',
      lastName: 'Owner',
      role: UserRole.AGENCY,
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('agencyName'));
      assert.ok(issue);
      assert.strictEqual(issue.message, 'Agency name is required for agency or agent role');
    }
  });

  it('should validate successfully for AGENCY role with agencyName', () => {
    const data = {
      email: 'agency@example.com',
      password: 'password123',
      firstName: 'Agency',
      lastName: 'Owner',
      role: UserRole.AGENCY,
      agencyName: 'Top Agency',
      agencyPhone: '+442012345678',
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, true);
  });

  it('accepts invited AGENT registration without separate agency details', () => {
    const result = RegisterUserDto.safeParse({
      email: 'invited@example.com',
      password: 'password123',
      firstName: 'Invited',
      lastName: 'Agent',
      role: UserRole.AGENT,
      inviteToken: 'A'.repeat(43),
    });
    assert.strictEqual(result.success, true);
  });

  it('does not allow tenant accounts to accept agency invitations', () => {
    const result = RegisterUserDto.safeParse({
      email: 'invited@example.com',
      password: 'password123',
      firstName: 'Invited',
      lastName: 'User',
      role: UserRole.TENANT,
      inviteToken: 'A'.repeat(43),
    });
    assert.strictEqual(result.success, false);
  });

  it('should fail validation for AGENT role without agencyName', () => {
    const data = {
      email: 'agent@example.com',
      password: 'password123',
      firstName: 'Agent',
      lastName: 'One',
      role: UserRole.AGENT,
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('agencyName'));
      assert.ok(issue);
    }
  });

  it('should fail validation for agency and agent roles without agencyPhone', () => {
    const data = {
      email: 'agent@example.com',
      password: 'password123',
      firstName: 'Agent',
      lastName: 'One',
      role: UserRole.AGENT,
      agencyName: 'Top Agency',
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.path.includes('agencyPhone')));
    }
  });
});
