import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTeamSeatUsage } from './team.service';

describe('team seat usage', () => {
  it('counts accepted members and pending invitations, excluding the founder', () => {
    assert.deepEqual(calculateTeamSeatUsage(5, 3, 1), {
      seatLimit: 5,
      usedSeats: 4,
      availableSeats: 1,
    });
  });

  it('does not allow additional invites after every seat is occupied', () => {
    assert.deepEqual(calculateTeamSeatUsage(1, 0, 1), {
      seatLimit: 1,
      usedSeats: 1,
      availableSeats: 0,
    });
  });

  it('reports zero available seats when existing members exceed a lowered seat limit', () => {
    assert.deepEqual(calculateTeamSeatUsage(1, 2, 0), {
      seatLimit: 1,
      usedSeats: 2,
      availableSeats: 0,
    });
  });
});
