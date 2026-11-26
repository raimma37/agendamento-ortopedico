import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function nextDateISO(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log("=== INICIANDO TESTES E2E COMPLETOS ===");

  // 1. Login Admin
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || "admin@clinica.com.br",
      password: process.env.ADMIN_PASSWORD || "admin123",
    }),
  });
  assert.equal(loginRes.status, 200, "Admin login deve retornar 200");
  const cookieHeader = loginRes.headers.get("set-cookie");
  assert.ok(cookieHeader, "Cookie de sessão deve ser definido");
  const cookie = cookieHeader.split(";")[0];
  console.log("✔ 1. Login administrativo OK");

  // 2. Gerar API Key
  const keyRes = await fetch(`${BASE}/api/admin/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "E2E Test Key" }),
  });
  assert.equal(keyRes.status, 201);
  const { rawKey, key: createdKey } = await keyRes.json();
  assert.ok(rawKey.startsWith("agd_live_"), "API Key deve ter prefixo agd_live_");
  console.log("✔ 2. API Key gerada:", createdKey.prefix);

  // 3. Verificar sigilo absoluto de isPrivatePriority nas rotas públicas e v1
  const bootRes = await fetch(`${BASE}/api/public/bootstrap`);
  assert.equal(bootRes.status, 200);
  const bootJson = await bootRes.json();
  assert.equal(
    JSON.stringify(bootJson).includes("isPrivatePriority"),
    false,
    "Rota pública NUNCA pode expor isPrivatePriority"
  );
  assert.equal(
    JSON.stringify(bootJson).includes("privateReserveSlots"),
    false,
    "Rota pública NUNCA pode expor privateReserveSlots"
  );

  const v1OptsRes = await fetch(`${BASE}/api/v1/form-options`, {
    headers: { "x-api-key": rawKey },
  });
  assert.equal(v1OptsRes.status, 200);
  const v1Opts = await v1OptsRes.json();
  assert.equal(
    JSON.stringify(v1Opts).includes("isPrivatePriority"),
    false,
    "API v1 form-options NUNCA pode expor isPrivatePriority"
  );
  console.log("✔ 3. Sigilo absoluto de isPrivatePriority verificado (público + API v1)");

  const particularOpt = bootJson.options.insurances.find((i) =>
    i.name.toLowerCase().includes("particular")
  );
  const convenioOpt = bootJson.options.insurances.find(
    (i) => !i.name.toLowerCase().includes("particular")
  );
  const visitTypeOpt = bootJson.options.visitTypes[0];
  const kneeOpt = bootJson.options.kneeOptions[0];
  assert.ok(particularOpt && convenioOpt && visitTypeOpt && kneeOpt);

  // 4. Subir servidor local de Webhook para validar HMAC + logs
  const receivedWebhooks = [];
  const webhookSecret = "e2e-hmac-secret-123";
  const whServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const sig = req.headers["x-webhook-signature"];
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
      receivedWebhooks.push({
        event: req.headers["x-webhook-event"],
        signatureValid: sig === expected,
        body: JSON.parse(body),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise((resolve) => whServer.listen(0, "127.0.0.1", resolve));
  const whPort = whServer.address().port;

  const whCreateRes = await fetch(`${BASE}/api/admin/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "E2E Webhook",
      url: `http://127.0.0.1:${whPort}/hook`,
      secret: webhookSecret,
      events: ["appointment.created", "appointment.confirmed", "appointment.canceled"],
      active: true,
    }),
  });
  assert.equal(whCreateRes.status, 201);
  const { webhook: createdWebhook } = await whCreateRes.json();

  // 5. Configurar Data Individual (DateException) com exatamente 2 vagas na Manhã
  const testDate1 = nextDateISO(5);
  const exRes1 = await fetch(`${BASE}/api/admin/date-exceptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      date: testDate1,
      isBlocked: false,
      reason: "Teste E2E Concorrência",
      shifts: [{ shift: "MORNING", maxSlots: 2, privateReserveSlots: 0 }],
    }),
  });
  assert.equal(exRes1.status, 200);
  console.log(`✔ 4. Data individual configurada (${testDate1}: Manhã = 2 vagas)`);

  // 6. Criar 1º agendamento e validar normalização WhatsApp E.164
  const book1Res = await fetch(`${BASE}/api/public/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "  João   da Silva ",
      whatsapp: "(91) 99999-1111",
      date: testDate1,
      shift: "MORNING",
      insuranceId: convenioOpt.id,
      visitTypeId: visitTypeOpt.id,
      kneeOptionId: kneeOpt.id,
      lgpdAccepted: true,
    }),
  });
  assert.equal(book1Res.status, 201);
  const book1 = await book1Res.json();
  assert.equal(book1.appointment.whatsapp, "5591999991111", "WhatsApp deve estar em E.164");
  console.log(`✔ 5. Agendamento #1 criado (${book1.appointment.protocol}), WhatsApp E.164 OK`);

  // 7. Testar bloqueio de duplicidade com variação de acento, caixa e espaços
  const dupRes = await fetch(`${BASE}/api/public/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "JOAO DA SILVA",
      whatsapp: "(91) 98888-2222",
      date: testDate1,
      shift: "MORNING",
      insuranceId: convenioOpt.id,
      visitTypeId: visitTypeOpt.id,
      kneeOptionId: kneeOpt.id,
      lgpdAccepted: true,
    }),
  });
  assert.equal(dupRes.status, 200);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.duplicate, true, "Deve identificar duplicidade");
  assert.equal(
    dupJson.appointment.protocol,
    book1.appointment.protocol,
    "Deve retornar o mesmo protocolo existente"
  );
  console.log("✔ 6. Bloqueio de duplicidade (normalização acento/caixa/espaços) OK");

  // 8. Disputa simultânea pela ÚLTIMA vaga (restam 1 de 2): Convênio vs Particular
  const [raceConvRes, racePartRes] = await Promise.all([
    fetch(`${BASE}/api/public/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: "Paciente Convênio Disputa",
        whatsapp: "(91) 99111-3333",
        date: testDate1,
        shift: "MORNING",
        insuranceId: convenioOpt.id,
        visitTypeId: visitTypeOpt.id,
        kneeOptionId: kneeOpt.id,
        lgpdAccepted: true,
      }),
    }),
    fetch(`${BASE}/api/public/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: "Paciente Particular Disputa",
        whatsapp: "(91) 99222-4444",
        date: testDate1,
        shift: "MORNING",
        insuranceId: particularOpt.id,
        visitTypeId: visitTypeOpt.id,
        kneeOptionId: kneeOpt.id,
        lgpdAccepted: true,
      }),
    }),
  ]);

  assert.equal(racePartRes.status, 201, "Particular DEVE vencer a disputa simultânea pela última vaga");
  assert.equal(raceConvRes.status, 409, "Convênio DEVE receber 409 (turno lotado)");
  const raceConvBody = await raceConvRes.json();
  assert.equal(
    /particular|prioridade|reserv/i.test(raceConvBody.error || ""),
    false,
    "Erro para Convênio NÃO pode revelar prioridade para Particular"
  );
  const racePartBody = await racePartRes.json();
  console.log(
    `✔ 7. Disputa simultânea pela última vaga: Particular venceu (${racePartBody.appointment.protocol}), Convênio recebeu 409 neutro ("${raceConvBody.error}")`
  );

  // 9. Testar Reserva Silenciosa para Particular (maxSlots: 2, privateReserveSlots: 1)
  const testDate2 = nextDateISO(6);
  await fetch(`${BASE}/api/admin/date-exceptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      date: testDate2,
      isBlocked: false,
      reason: "Teste Reserva Silenciosa",
      shifts: [{ shift: "MORNING", maxSlots: 2, privateReserveSlots: 1 }],
    }),
  });

  // 1º convênio entra (1/2)
  const resSlot1 = await fetch(`${BASE}/api/public/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Convênio Normal 1",
      whatsapp: "(91) 99333-1111",
      date: testDate2,
      shift: "MORNING",
      insuranceId: convenioOpt.id,
      visitTypeId: visitTypeOpt.id,
      kneeOptionId: kneeOpt.id,
      lgpdAccepted: true,
    }),
  });
  assert.equal(resSlot1.status, 201);

  // 2º convênio é bloqueado porque a última vaga é reserva silenciosa
  const resSlot2Conv = await fetch(`${BASE}/api/public/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Convênio Bloqueado Reserva",
      whatsapp: "(91) 99333-2222",
      date: testDate2,
      shift: "MORNING",
      insuranceId: convenioOpt.id,
      visitTypeId: visitTypeOpt.id,
      kneeOptionId: kneeOpt.id,
      lgpdAccepted: true,
    }),
  });
  assert.equal(resSlot2Conv.status, 409);

  // 2º particular consegue reservar a vaga silenciosa!
  const resSlot2Part = await fetch(`${BASE}/api/public/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Particular Reserva Silenciosa",
      whatsapp: "(91) 99333-3333",
      date: testDate2,
      shift: "MORNING",
      insuranceId: particularOpt.id,
      visitTypeId: visitTypeOpt.id,
      kneeOptionId: kneeOpt.id,
      lgpdAccepted: true,
    }),
  });
  assert.equal(resSlot2Part.status, 201);
  console.log("✔ 8. Reserva Silenciosa (privateReserveSlots) validada com sucesso");

  // 10. Consultar via API v1 (by-phone), confirmar e cancelar devolvendo a vaga
  const byPhoneRes = await fetch(
    `${BASE}/api/v1/appointments/by-phone/5591999991111`,
    { headers: { "x-api-key": rawKey } }
  );
  assert.equal(byPhoneRes.status, 200);
  const byPhoneJson = await byPhoneRes.json();
  assert.ok(byPhoneJson.appointments.length >= 1);
  const aptId = byPhoneJson.appointments[0].id;

  const confirmRes = await fetch(`${BASE}/api/v1/appointments/${aptId}/confirm`, {
    method: "PATCH",
    headers: { "x-api-key": rawKey },
  });
  assert.equal(confirmRes.status, 200);
  const confirmJson = await confirmRes.json();
  assert.equal(confirmJson.appointment.status, "CONFIRMED");
  assert.equal(confirmJson.appointment.confirmedVia, "WHATSAPP_API");

  const cancelRes = await fetch(`${BASE}/api/v1/appointments/${aptId}/cancel`, {
    method: "PATCH",
    headers: { "x-api-key": rawKey, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Teste E2E resposta 2" }),
  });
  assert.equal(cancelRes.status, 200);
  const cancelJson = await cancelRes.json();
  assert.equal(cancelJson.appointment.status, "CANCELED");
  assert.equal(cancelJson.slotReleased, true);

  // Verifica que a vaga devolvida no testDate1 agora permite novo agendamento!
  const availAfterCancel = await fetch(
    `${BASE}/api/v1/availability?startDate=${testDate1}&endDate=${testDate1}`,
    { headers: { "x-api-key": rawKey } }
  );
  const availJson = await availAfterCancel.json();
  assert.equal(availJson.days[0].shifts[0].remainingSlots, 1, "Vaga cancelada deve voltar imediatamente");
  console.log("✔ 9. API v1 (by-phone -> confirm -> cancel -> devolução imediata de vaga) OK");

  // 11. Validar Webhooks recebidos com assinatura HMAC válida
  await new Promise((r) => setTimeout(r, 400));
  const eventsReceived = receivedWebhooks.map((w) => w.event);
  assert.ok(eventsReceived.includes("appointment.created"), "Webhook created disparado");
  assert.ok(eventsReceived.includes("appointment.confirmed"), "Webhook confirmed disparado");
  assert.ok(eventsReceived.includes("appointment.canceled"), "Webhook canceled disparado");
  assert.ok(
    receivedWebhooks.every((w) => w.signatureValid),
    "Todas assinaturas HMAC-SHA256 devem ser válidas"
  );
  console.log(`✔ 10. Webhooks HMAC-SHA256 validados (${receivedWebhooks.length} eventos recebidos)`);

  // 12. Validar Relatório JSON + CSV + Download Templates n8n + OpenAPI
  const repRes = await fetch(
    `${BASE}/api/admin/reports?startDate=${testDate1}&endDate=${testDate2}`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(repRes.status, 200);
  const csvRes = await fetch(
    `${BASE}/api/admin/reports?startDate=${testDate1}&endDate=${testDate2}&format=csv`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(csvRes.status, 200);
  assert.ok((await csvRes.text()).includes("Protocolo"));

  const tpl1 = await fetch(
    `${BASE}/api/admin/n8n-templates/fluxo-lembrete-cron.json`,
    { headers: { Cookie: cookie } }
  );
  const tpl2 = await fetch(
    `${BASE}/api/admin/n8n-templates/fluxo-resposta-whatsapp.json`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(tpl1.status, 200);
  assert.equal(tpl2.status, 200);
  JSON.parse(await tpl1.text());
  JSON.parse(await tpl2.text());

  const docsRes = await fetch(`${BASE}/api/docs`);
  assert.equal(docsRes.status, 200);
  const docsJson = await docsRes.json();
  assert.equal(docsJson.openapi, "3.0.3");
  console.log("✔ 11. Relatórios (JSON + CSV), Templates n8n (.json) e OpenAPI (/api/docs) OK");

  // Limpeza do webhook temporário e encerramento do mock server
  await fetch(`${BASE}/api/admin/webhooks?id=${createdWebhook.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  await fetch(`${BASE}/api/admin/api-keys?id=${createdKey.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  whServer.close();

  console.log("\n=== TODOS OS 11 TESTES E2E PASSARAM COM SUCESSO! ===");
}

run().catch((err) => {
  console.error("FALHA NO TESTE E2E:", err);
  process.exit(1);
});
