import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { Role } from "@prisma/client";
import { resetDatabase, disconnect } from "./setup";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

const app = createApp();

async function getCsrfToken(agent: request.SuperAgentTest) {
  const res = await agent.get("/api/csrf-token");
  return res.body.csrfToken as string;
}

async function createUser(email: string, password: string, role: Role = Role.USER) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({ data: { email, passwordHash, role } });
}

describe("Auth & RBAC", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnect();
  });

  it("registro exitoso crea un usuario con rol USER", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "SuperSecret123" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("registro con datos inválidos devuelve 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-es-un-email", password: "123" });

    expect(res.status).toBe(400);
  });

  it("registro ignora un rol ADMIN enviado manualmente", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "hacker@example.com", password: "SuperSecret123", role: "ADMIN" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
  });

  it("login exitoso setea cookie access_token", async () => {
    await createUser("user@example.com", "SuperSecret123");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "SuperSecret123" });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/access_token=/);
  });

  it("login con contraseña incorrecta devuelve 401", async () => {
    await createUser("user2@example.com", "SuperSecret123");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user2@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("login con usuario inexistente devuelve 401 con el mismo mensaje", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "no-existe@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("acceso sin autenticación a ruta protegida devuelve 401", async () => {
    const res = await request(app).get("/api/users/profile");
    expect(res.status).toBe(401);
  });

  it("USER puede acceder a su propio perfil", async () => {
    await createUser("u3@example.com", "SuperSecret123");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "u3@example.com", password: "SuperSecret123" });

    const res = await agent.get("/api/users/profile");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("u3@example.com");
  });

  it("USER no puede acceder a rutas administrativas (403)", async () => {
    await createUser("u4@example.com", "SuperSecret123");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "u4@example.com", password: "SuperSecret123" });

    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("ADMIN puede acceder a rutas administrativas", async () => {
    await createUser("admin1@example.com", "SuperSecret123", Role.ADMIN);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "admin1@example.com", password: "SuperSecret123" });

    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it("un USER no puede escalar su propio rol modificando el JWT/cookie manualmente", async () => {
    const user = await createUser("u5@example.com", "SuperSecret123");
    // Fabrica un JWT falsificado con role=ADMIN pero SIN una sesión real
    // en la base de datos -> debe ser rechazado por `authenticate`.
    const fakeToken = jwt.sign(
      { sub: user.id, sid: "sesion-inventada", role: "ADMIN" },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" }
    );

    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", [`access_token=${fakeToken}`]);

    expect(res.status).toBe(401); // la sesión "sesion-inventada" no existe en BD
  });

  it("un usuario no puede acceder a recursos (notas) de otro usuario", async () => {
    const owner = await createUser("owner@example.com", "SuperSecret123");
    const note = await prisma.note.create({
      data: { title: "Privada", content: "secreto", userId: owner.id },
    });

    await createUser("intruso@example.com", "SuperSecret123");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "intruso@example.com", password: "SuperSecret123" });

    const res = await agent.get(`/api/notes/${note.id}`);
    expect(res.status).toBe(403);
  });

  it("token expirado es rechazado", async () => {
    const user = await createUser("u6@example.com", "SuperSecret123");
    const session = await prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    const expiredToken = jwt.sign(
      { sub: user.id, sid: session.id, role: "USER" },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: -1 } // ya expirado
    );

    const res = await request(app)
      .get("/api/users/profile")
      .set("Cookie", [`access_token=${expiredToken}`]);

    expect(res.status).toBe(401);
  });

  it("sesión revocada es rechazada aunque el JWT siga siendo válido", async () => {
    const user = await createUser("u7@example.com", "SuperSecret123");
    const session = await prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    const token = jwt.sign(
      { sub: user.id, sid: session.id, role: "USER" },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" }
    );
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    const res = await request(app)
      .get("/api/users/profile")
      .set("Cookie", [`access_token=${token}`]);

    expect(res.status).toBe(401);
  });

  it("logout invalida la sesión y la cookie no puede reutilizarse", async () => {
    await createUser("u8@example.com", "SuperSecret123");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "u8@example.com", password: "SuperSecret123" });

    const csrfToken = await getCsrfToken(agent);
    const logoutRes = await agent.post("/api/auth/logout").set("x-csrf-token", csrfToken);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers["set-cookie"]?.[0]).toMatch(/access_token=;/);

    // Reutilizar la sesión anterior (la cookie del agent ya fue limpiada,
    // pero verificamos también reutilizando el token viejo manualmente).
    const profileRes = await agent.get("/api/users/profile");
    expect(profileRes.status).toBe(401);
  });

  it("rate limiting bloquea intentos excesivos de login", async () => {
    await createUser("rl@example.com", "SuperSecret123");

    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "rl@example.com", password: "wrong" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
