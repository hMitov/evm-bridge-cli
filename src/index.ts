#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { SelectTokenCommand } from './commands/SelectTokenCommand';
import { SelectTargetChainCommand } from './commands/SelectTargetChainCommand';
import { LockCommand } from './commands/LockCommand';
import { ClaimWrappedCommand } from './commands/ClaimWrappedCommand';
import { ClaimOriginCommand } from './commands/ClaimOriginCommand';
import { BurnTokenCommand } from './commands/BurnTokenCommand';
import { HistoryCommand } from './commands/HistoryCommand';
import { SwitchNetworkCommand } from './commands/SwitchNetworkCommand';
import { LockNativeCommand } from './commands/LockNative';
import { MultiChainRelayer } from './relayer/MultiChainRelayer';

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
  .command('lock-native')
  .description('Lock tokens native tokens')
  .action(async () => {
    const command = new LockNativeCommand();
    await command.execute();
  });

program
  .command('claim-wrapped')
  .description('Claim tokens on the target chain')
  .action(async () => {
    const command = new ClaimWrappedCommand();
    await command.execute();
  });

program
  .command('claim-origin')
  .description('Claim tokens on the source chain')
  .action(async () => {
    const command = new ClaimOriginCommand();
    await command.execute();
  });

program
  .command('burn-token')
  .description('Burn wrapped tokens on the target chain')
  .action(async () => {
    const command = new BurnTokenCommand();
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

program
  .command('relayer')
  .description('Start the relayer process to listen for bridge events')
  .option('-d, --detach', 'Run in detached mode (background process)')
  .action(async (options) => {
    const relayer = new MultiChainRelayer();
    console.log('[Relayer] Starting relayer process...');
    
    if (options.detach) {
      // Detach from parent process
      process.stdin.end();
      process.stdout.unref();
      process.stderr.unref();
    }

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n[Relayer] Shutting down...');
      relayer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Relayer] Shutting down...');
      relayer.stop();
      process.exit(0);
    });
  });

program.parse(); 