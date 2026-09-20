import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const password = process.env.APP_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const sessionHours = Number.parseInt(process.env.SESSION_HOURS ?? "8", 10);
const isProduction = process.env.NODE_ENV === "production";
const httpsCertificatePath = process.env.HTTPS_CERT_PATH;
const httpsKeyPath = process.env.HTTPS_KEY_PATH;
const isHttps = Boolean(httpsCertificatePath || httpsKeyPath);

const cookieName = "bar_companion_session";
const maxBodyBytes = 8_192;
const failedAttempts = new Map();
const attemptWindowMs = 10 * 60 * 1_000;
const maximumAttempts = 5;

const publicPaths = new Set([
  "/login",
  "/login.html",
  "/login.css",
  "/login.js"
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

if (!password || !sessionSecret) {
  console.error("APP_PASSWORD and SESSION_SECRET must be set in .env.");
  process.exit(1);
}

if (sessionSecret.length < 32) {
  console.error("SESSION_SECRET must contain at least 32 characters.");
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error("PORT must be a valid TCP port number.");
  process.exit(1);
}

if (isHttps && (!httpsCertificatePath || !httpsKeyPath)) {
  console.error("HTTPS_CERT_PATH and HTTPS_KEY_PATH must both be set.");
  process.exit(1);
}

if (
  isHttps &&
  (!existsSync(resolve(rootDirectory, httpsCertificatePath)) ||
    !existsSync(resolve(rootDirectory, httpsKeyPath)))
) {
  console.error("The configured HTTPS certificate or key file does not exist.");
  process.exit(1);
}

function applySecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'"
  ].join("; "));
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "microphone=(self)");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cache-Control", "no-store");
}

function sendRedirect(response, location) {
  response.writeHead(303, { Location: location });
  response.end();
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(message);
}

function parseCookies(request) {
  const cookies = {};
  const cookieHeader = request.headers.cookie ?? "";

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[key] = value;
  }

  return cookies;
}

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + sessionHours * 60 * 60 * 1_000,
    nonce: randomBytes(16).toString("hex")
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function isValidSession(request) {
  const token = parseCookies(request)[cookieName];

  if (!token) {
    return false;
  }

  const [payload, providedSignature] = token.split(".");

  if (!payload || !providedSignature) {
    return false;
  }

  const expectedSignature = sign(payload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function createSessionCookie(token) {
  const maxAge = sessionHours * 60 * 60;
  const secureAttribute = isHttps || isProduction ? "Secure" : "";

  return [
    `${cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secureAttribute
  ].filter(Boolean).join("; ");
}

function clearSessionCookie() {
  const secureAttribute = isHttps || isProduction ? "Secure" : "";
  return [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secureAttribute
  ].filter(Boolean).join("; ");
}

function isSameText(first, second) {
  const firstDigest = createHmac("sha256", sessionSecret).update(first).digest();
  const secondDigest = createHmac("sha256", sessionSecret).update(second).digest();
  return timingSafeEqual(firstDigest, secondDigest);
}

function clientAddress(request) {
  return request.socket.remoteAddress ?? "unknown";
}

function isRateLimited(address) {
  const record = failedAttempts.get(address);

  if (!record || Date.now() - record.startedAt > attemptWindowMs) {
    failedAttempts.delete(address);
    return false;
  }

  return record.count >= maximumAttempts;
}

function recordFailedAttempt(address) {
  const record = failedAttempts.get(address);

  if (!record || Date.now() - record.startedAt > attemptWindowMs) {
    failedAttempts.set(address, { count: 1, startedAt: Date.now() });
    return;
  }

  record.count += 1;
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBodyBytes) {
        rejectBody(new Error("Request body is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });

    request.on("error", rejectBody);
  });
}

function resolvePublicFile(pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(requestedPath);
  } catch {
    return null;
  }

  const filePath = resolve(rootDirectory, `.${decodedPath}`);
  const rootPrefix = rootDirectory.endsWith(sep) ? rootDirectory : `${rootDirectory}${sep}`;

  if (!filePath.startsWith(rootPrefix) || !existsSync(filePath)) {
    return null;
  }

  const fileStatus = statSync(filePath);
  return fileStatus.isFile() ? filePath : null;
}

function isAllowedStaticPath(pathname) {
  const individualFiles = new Set([
    "/index.html",
    "/styles.css",
    "/app.js",
    "/login.html",
    "/login.css",
    "/login.js",
    "/data/characters.json"
  ]);

  if (individualFiles.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/assets/characters/") &&
    [".png", ".svg", ".webp"].includes(extname(pathname).toLowerCase());
}

function serveFile(request, response, pathname) {
  const publicPath = pathname === "/" ? "/index.html" : pathname;

  if (!isAllowedStaticPath(publicPath)) {
    sendText(response, 404, "Not found");
    return;
  }

  const filePath = resolvePublicFile(publicPath);

  if (!filePath) {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath).toLowerCase()] ??
      "application/octet-stream"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function handleLogin(request, response) {
  const address = clientAddress(request);

  if (isRateLimited(address)) {
    response.setHeader("Retry-After", "600");
    sendText(response, 429, "試行回数が多すぎます。10分後にお試しください。");
    return;
  }

  try {
    const body = await readRequestBody(request);
    const submittedPassword = new URLSearchParams(body).get("password") ?? "";

    if (!isSameText(submittedPassword, password)) {
      recordFailedAttempt(address);
      sendRedirect(response, "/login?error=invalid");
      return;
    }

    failedAttempts.delete(address);
    response.setHeader("Set-Cookie", createSessionCookie(createSessionToken()));
    sendRedirect(response, "/");
  } catch {
    sendText(response, 400, "Bad request");
  }
}

async function handleRequest(request, response) {
  applySecurityHeaders(response);

  const protocol = isHttps ? "https" : "http";
  const requestUrl = new URL(request.url ?? "/", `${protocol}://${request.headers.host}`);
  const pathname = requestUrl.pathname;

  if (request.method === "POST" && pathname === "/login") {
    await handleLogin(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/logout") {
    response.setHeader("Set-Cookie", clearSessionCookie());
    sendRedirect(response, "/login");
    return;
  }

  if (!isValidSession(request) && !publicPaths.has(pathname)) {
    sendRedirect(response, "/login");
    return;
  }

  if (isValidSession(request) && ["/login", "/login.html"].includes(pathname)) {
    sendRedirect(response, "/");
    return;
  }

  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    sendText(response, 405, "Method not allowed");
    return;
  }

  serveFile(request, response, pathname === "/login" ? "/login.html" : pathname);
}

const server = isHttps
  ? createHttpsServer({
      cert: readFileSync(resolve(rootDirectory, httpsCertificatePath)),
      key: readFileSync(resolve(rootDirectory, httpsKeyPath))
    }, handleRequest)
  : createHttpServer(handleRequest);

server.listen(port, "0.0.0.0", () => {
  const protocol = isHttps ? "https" : "http";
  console.log(`Bar Companion is running at ${protocol}://localhost:${port}`);
});
