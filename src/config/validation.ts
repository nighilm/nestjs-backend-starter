import Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:5173'),
    }),
  CORS_ORIGIN: Joi.string().allow('').optional(),
  SESSION_COOKIE_NAME: Joi.string().optional(),
  SESSION_IDLE_TIMEOUT_SECONDS: Joi.number().integer().positive().default(86400),
  SESSION_ABSOLUTE_TIMEOUT_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(604800),
  SESSION_ACTIVITY_REFRESH_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(3600),
  SESSION_SECURE: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),
  SESSION_SAME_SITE: Joi.string().valid('lax', 'strict').default('lax'),
  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  SEED_ADMIN_NAME: Joi.string().optional(),
}).required();
