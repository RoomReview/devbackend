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

  describe('EarlyAccessRegisterDto Validation', () => {
    const validData = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    };

    it('accepts the minimal early access registration form', () => {
      assert.strictEqual(EarlyAccessRegisterDto.safeParse(validData).success, true);
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
    };
    const result = RegisterUserDto.safeParse(data);
    assert.strictEqual(result.success, true);
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
});
