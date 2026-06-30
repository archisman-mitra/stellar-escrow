import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EscrowCard } from './EscrowCard';
import { describe, it, expect, vi } from 'vitest';
import type { Escrow } from '../types/escrow';

describe('EscrowCard', () => {
  const baseEscrow: Escrow = {
    id: 1,
    sender: 'GA123',
    recipient: 'GB456',
    token: 'XLM',
    amount: '100',
    deadline: 0,
    status: 'Locked',
  };

  it('renders a "Claim" button if status is "Locked" and connected wallet matches recipient', () => {
    render(
      <EscrowCard
        escrow={baseEscrow}
        connectedAddress="GB456"
        onClaim={vi.fn()}
        onRefund={vi.fn()}
      />
    );
    
    expect(screen.getByRole('button', { name: /Claim/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refund/i })).not.toBeInTheDocument();
  });

  it('renders no action button if status is "Claimed"', () => {
    render(
      <EscrowCard
        escrow={{ ...baseEscrow, status: 'Claimed' }}
        connectedAddress="GB456"
        onClaim={vi.fn()}
        onRefund={vi.fn()}
      />
    );
    
    expect(screen.queryByRole('button', { name: /Claim/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refund/i })).not.toBeInTheDocument();
  });
});
