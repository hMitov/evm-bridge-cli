import { InterfaceAbi } from 'ethers';

declare module '*.json' {
  const value: InterfaceAbi;
  export default value;
} 