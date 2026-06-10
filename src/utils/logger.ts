export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export class Logger {
	private level: LogLevel;

	constructor(level: LogLevel = LogLevel.INFO) {
		this.level = level;
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	debug(msg: string, ...args: unknown[]): void {
		if (this.level <= LogLevel.DEBUG) {
			console.debug(`[Codebuddian] ${msg}`, ...args);
		}
	}

	info(msg: string, ...args: unknown[]): void {
		if (this.level <= LogLevel.INFO) {
			console.info(`[Codebuddian] ${msg}`, ...args);
		}
	}

	warn(msg: string, ...args: unknown[]): void {
		if (this.level <= LogLevel.WARN) {
			console.warn(`[Codebuddian] ${msg}`, ...args);
		}
	}

	error(msg: string, ...args: unknown[]): void {
		if (this.level <= LogLevel.ERROR) {
			console.error(`[Codebuddian] ${msg}`, ...args);
		}
	}
}

export const logger = new Logger();
