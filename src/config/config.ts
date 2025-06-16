import * as Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const configValidationSchema = Joi.object({
  ETHEREUM_SEPOLIA_WS_URL: Joi.string().uri().required(),
  BASE_SEPOLIA_WS_URL: Joi.string().uri().required(),
  ETHEREUM_SEPOLIA_BRIDGE_FACTORY: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  BASE_SEPOLIA_BRIDGE_FACTORY: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  USER_PRIVATE_KEY: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
  RELAYER_PRIVATE_KEY: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
});

const { error, value: envVars } = configValidationSchema.validate(process.env, { allowUnknown: true });
if (error) {
  console.error('Config validation error:', error.message);
  process.exit(1);
}

export const ETHEREUM_SEPOLIA_WS_URL = envVars.ETHEREUM_SEPOLIA_WS_URL;
export const BASE_SEPOLIA_WS_URL = envVars.BASE_SEPOLIA_WS_URL;
export const USER_PRIVATE_KEY = envVars.USER_PRIVATE_KEY;
export const RELAYER_PRIVATE_KEY = envVars.RELAYER_PRIVATE_KEY;
