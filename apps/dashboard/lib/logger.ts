import pino from "pino";

const logger = pino({
  base: null,
  redact: ["req.headers.authorization", "authorization", "token", "keyHash"],
});

export function createLogger(source: string) {
  return logger.child({ source });
}

export { logger };
