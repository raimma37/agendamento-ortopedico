export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "API de Agendamento Ortopédico por Cotas",
      version: "1.0.0",
      description:
        "API REST para integração com n8n, WhatsApp (Evolution API / Cloud API) e sistemas externos. Autenticação via header `x-api-key` ou `Authorization: Bearer <chave>`.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    paths: {
      "/api/v1/appointments": {
        get: {
          summary: "Listar agendamentos",
          parameters: [
            { name: "date", in: "query", schema: { type: "string", example: "2026-11-26" } },
            { name: "shift", in: "query", schema: { type: "string", enum: ["MORNING", "AFTERNOON", "FULL_DAY"] } },
            { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELED", "NO_SHOW"] } },
            { name: "whatsapp", in: "query", schema: { type: "string", example: "5591999999999" } },
            { name: "patientName", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Lista de agendamentos" },
            "401": { description: "API Key inválida ou ausente" },
          },
        },
        post: {
          summary: "Criar agendamento via API",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["patientName", "whatsapp", "date", "shift", "insuranceId", "visitTypeId", "kneeOptionId"],
                  properties: {
                    patientName: { type: "string", example: "João da Silva" },
                    whatsapp: { type: "string", example: "5591999999999" },
                    date: { type: "string", example: "2026-11-26" },
                    shift: { type: "string", enum: ["MORNING", "AFTERNOON", "FULL_DAY"] },
                    insuranceId: { type: "string" },
                    visitTypeId: { type: "string" },
                    kneeOptionId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Agendamento criado" },
            "200": { description: "Agendamento duplicado retornado com protocolo existente" },
            "409": { description: "Turno sem vagas disponíveis" },
          },
        },
      },
      "/api/v1/appointments/by-phone/{whatsapp}": {
        get: {
          summary: "Buscar próximos agendamentos ativos por WhatsApp",
          parameters: [
            { name: "whatsapp", in: "path", required: true, schema: { type: "string", example: "5591999999999" } },
          ],
          responses: {
            "200": { description: "Próximos agendamentos ativos encontrados" },
          },
        },
      },
      "/api/v1/appointments/{id}/confirm": {
        patch: {
          summary: "Confirmar agendamento (via WhatsApp/n8n)",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Agendamento confirmado" },
          },
        },
      },
      "/api/v1/appointments/{id}/cancel": {
        patch: {
          summary: "Cancelar agendamento e devolver vaga automaticamente",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reason: { type: "string", example: "Cancelado pelo paciente via WhatsApp" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Agendamento cancelado e vaga devolvida" },
          },
        },
      },
      "/api/v1/availability": {
        get: {
          summary: "Consultar disponibilidade de datas e turnos",
          parameters: [
            { name: "startDate", in: "query", required: true, schema: { type: "string", example: "2026-11-26" } },
            { name: "endDate", in: "query", required: true, schema: { type: "string", example: "2026-12-10" } },
          ],
          responses: {
            "200": { description: "Disponibilidade por data e turno" },
          },
        },
      },
      "/api/v1/form-options": {
        get: {
          summary: "Listar opções fixas ativas do formulário",
          responses: {
            "200": { description: "Convênios, tipos de consulta e opções de joelho ativos" },
          },
        },
      },
    },
  };
}
