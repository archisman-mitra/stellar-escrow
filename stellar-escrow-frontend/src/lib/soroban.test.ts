import { describe, it, expect, vi } from 'vitest';
import { getEscrowCount, parseAndThrowError, rpcServer } from './soroban';
import { rpc, nativeToScVal } from '@stellar/stellar-sdk';

// Mock the RPC server
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Api: {
        ...actual.rpc.Api,
        isSimulationSuccess: vi.fn(),
      }
    }
  };
});

describe('soroban', () => {
  describe('getEscrowCount', () => {
    it('correctly decodes a mocked successful simulation response into a number', async () => {
      // Mock the simulateTransaction response
      const mockResult = {
        result: {
          retval: nativeToScVal(42, { type: 'u32' }),
        },
      };

      vi.spyOn(rpcServer, 'simulateTransaction').mockResolvedValue(mockResult as any);
      vi.mocked(rpc.Api.isSimulationSuccess).mockReturnValue(true);

      const count = await getEscrowCount();
      expect(count).toBe(42);
      expect(rpcServer.simulateTransaction).toHaveBeenCalled();
    });
  });

  describe('parseAndThrowError', () => {
    it('correctly converts contract error code 2 into "NotAuthorized"', () => {
      expect(() => parseAndThrowError(new Error("Error(Contract, 2)"))).toThrow("NotAuthorized");
      expect(() => parseAndThrowError("ContractError: 2")).toThrow("NotAuthorized");
    });

    it('correctly converts contract error code 4 into "DeadlineNotReached"', () => {
      expect(() => parseAndThrowError({ message: "Code: 4" })).toThrow("DeadlineNotReached");
      expect(() => parseAndThrowError("4")).toThrow("DeadlineNotReached");
    });

    it('throws original message if code not mapped', () => {
      expect(() => parseAndThrowError(new Error("Something else failed"))).toThrow("Something else failed");
    });
  });
});
