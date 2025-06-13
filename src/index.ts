#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { SelectTokenCommand } from './commands/SelectTokenCommand';
import { SelectTargetChainCommand } from './commands/SelectTargetChainCommand';
import { LockCommand } from './commands/LockCommand';
import { ClaimCommand } from './commands/ClaimCommand';
import { ReturnCommand } from './commands/ReturnCommand';
import { HistoryCommand } from './commands/HistoryCommand';
import { SwitchNetworkCommand } from './commands/SwitchNetworkCommand';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('bridge')
  .description('CLI tool for bridging tokens between EVM-compatible chains')
  .version('1.0.0');

program
  .command('select-token')
  .description('Select a token to bridge')
  .action(async () => {
    const command = new SelectTokenCommand();
    await command.execute();
  });

program
  .command('select-target-chain')
  .description('Select the target chain for bridging')
  .action(async () => {
    const command = new SelectTargetChainCommand();
    await command.execute();
  });

program
  .command('lock')
  .description('Lock tokens for bridging')
  .action(async () => {
    const command = new LockCommand();
    await command.execute();
  });

program
  .command('claim')
  .description('Claim tokens on the target chain')
  .action(async () => {
    const command = new ClaimCommand();
    await command.execute();
  });

program
  .command('return')
  .description('Return tokens to the source chain')
  .action(async () => {
    const command = new ReturnCommand();
    await command.execute();
  });

program
  .command('history')
  .description('View bridge transaction history')
  .action(async () => {
    const command = new HistoryCommand();
    await command.execute();
  });

program
  .command('switch-network')
  .description('Switch the connected network')
  .action(async () => {
    const command = new SwitchNetworkCommand();
    await command.execute();
  });

program.parse(); 