/**
 * Structured logging utility for server-side operations
 * 
 * Provides consistent, structured logging format for debugging and monitoring.
 * All logs include timestamps and contextual information.
 */

export interface LogContext {
	timestamp: string;
	requestId?: string;
	sessionId?: string;
	url?: string;
	urls?: string[];
	pageUrl?: string;
	statusCode?: number;
	retryCount?: number;
	error?: string;
	message?: string;
	checked?: number;
	total?: number;
	timedOut?: boolean;
	[key: string]: unknown;
}

export type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Formats a log entry with structured context
 */
function formatLog(level: LogLevel, message: string, context?: Partial<LogContext>): string {
	const logEntry: LogContext = {
		timestamp: new Date().toISOString(),
		...context,
		message,
	};

	return JSON.stringify({
		level,
		...logEntry,
	});
}

/**
 * Logs an info message with structured context
 */
export function logInfo(message: string, context?: Partial<LogContext>): void {
	console.log(formatLog("info", message, context));
}

/**
 * Logs a warning message with structured context
 */
export function logWarn(message: string, context?: Partial<LogContext>): void {
	console.warn(formatLog("warn", message, context));
}

/**
 * Logs an error message with structured context
 */
export function logError(message: string, context?: Partial<LogContext>): void {
	console.error(formatLog("error", message, context));
}

/**
 * Logs a debug message with structured context
 */
export function logDebug(message: string, context?: Partial<LogContext>): void {
	console.debug(formatLog("debug", message, context));
}

/**
 * Logs authentication failures with context
 * Requirement: 6.4
 */
export function logAuthFailure(reason: string, context?: Partial<LogContext>): void {
	logWarn("Authentication failed", {
		...context,
		reason,
	});
}

/**
 * Logs link check errors with URL and error details
 * Requirement: 6.4
 */
export function logLinkCheckError(url: string, error: string, context?: Partial<LogContext>): void {
	logError("Link check failed", {
		...context,
		url,
		error,
	});
}

/**
 * Logs client disconnections
 * Requirement: 6.4
 */
export function logClientDisconnection(context?: Partial<LogContext>): void {
	logInfo("Client disconnected", {
		...context,
	});
}

/**
 * Logs request validation errors
 */
export function logValidationError(errors: Array<{ field: string; message: string }>, context?: Partial<LogContext>): void {
	logWarn("Request validation failed", {
		...context,
		validationErrors: errors,
	});
}

/**
 * Logs successful link check completion
 */
export function logLinkCheckComplete(checked: number, total: number, timedOut: boolean, context?: Partial<LogContext>): void {
	logInfo("Link check completed", {
		...context,
		checked,
		total,
		timedOut,
	});
}

/**
 * Logs retry attempts
 */
export function logRetryAttempt(url: string, attempt: number, error: string, context?: Partial<LogContext>): void {
	logDebug("Retrying link check", {
		...context,
		url,
		retryCount: attempt,
		error,
	});
}
