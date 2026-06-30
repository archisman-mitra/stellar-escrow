
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateEscrowForm } from './CreateEscrowModal';
import { vi, describe, it, expect } from 'vitest';
import * as soroban from '../lib/soroban';
import * as wallet from '../lib/wallet';

// Mock dependencies
vi.mock('../lib/soroban', () => ({
  createEscrow: vi.fn(),
}));

vi.mock('../lib/wallet', () => ({
  useWallet: vi.fn(),
}));

describe('CreateEscrowForm', () => {
  it('shows validation error for empty recipient and does not call createEscrow', async () => {
    vi.mocked(wallet.useWallet).mockReturnValue({
      address: 'GABC123',
      kit: {} as any,
      connecting: false,
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(<CreateEscrowForm onCreated={onCreated} onClose={onClose} />);

    // Click submit without filling the recipient
    fireEvent.click(screen.getByRole('button', { name: /create escrow/i }));

    // Should show validation error
    expect(screen.getByText('Enter a valid Stellar address (starts with G, 56 chars).')).toBeInTheDocument();

    // Should not call createEscrow
    expect(soroban.createEscrow).not.toHaveBeenCalled();
  });
});
