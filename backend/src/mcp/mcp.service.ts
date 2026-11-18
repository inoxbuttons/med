import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { MisRegistry } from '../adapters/mis/mis-registry.service';
import { resolveSlot } from '../core/ports';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  readonly server: McpServer;

  constructor(
    private readonly openAi: OpenAiService,
    private readonly gigaChat: GigaChatService,
    private readonly mis: MisRegistry,
  ) {
    this.server = new McpServer({ name: 'med-mcp-server', version: '0.1.0' });
  }

  onModuleInit() {
    this.registerTools();
    this.logger.log('MCP server initialized with tools registered');
  }

  private registerTools() {
    (this.server.tool as any)(
      'ask_openai',
      'Send a prompt to OpenAI and get a response',
      { prompt: z.string(), model: z.string().optional() },
      async ({ prompt, model }: { prompt: string; model?: string }) => {
        const content = await this.openAi.chat([{ role: 'user', content: prompt }], model);
        return { content: [{ type: 'text', text: content }] };
      },
    );

    (this.server.tool as any)(
      'ask_gigachat',
      'Send a prompt to GigaChat and get a response',
      { prompt: z.string(), model: z.string().optional() },
      async ({ prompt, model }: { prompt: string; model?: string }) => {
        const content = await this.gigaChat.chat([{ role: 'user', content: prompt }], model);
        return { content: [{ type: 'text', text: content }] };
      },
    );

    (this.server.tool as any)(
      'get_clinics',
      'Клиники сети',
      { clinicNetId: z.number() },
      async ({ clinicNetId }: { clinicNetId: number }) => {
        const { catalog } = await this.mis.forNet(clinicNetId);
        return this.text(await catalog.clinics());
      },
    );

    (this.server.tool as any)(
      'find_doctors',
      'Поиск врачей сети по специальности или фамилии',
      { clinicNetId: z.number(), query: z.string(), clinicId: z.number().optional() },
      async ({ clinicNetId, query, clinicId }: { clinicNetId: number; query: string; clinicId?: number }) => {
        const { catalog } = await this.mis.forNet(clinicNetId);
        return this.text(await catalog.searchDoctors(query, clinicId));
      },
    );

    (this.server.tool as any)(
      'find_services',
      'Поиск услуг сети по названию',
      { clinicNetId: z.number(), query: z.string(), clinicId: z.number().optional() },
      async ({ clinicNetId, query, clinicId }: { clinicNetId: number; query: string; clinicId?: number }) => {
        const { catalog } = await this.mis.forNet(clinicNetId);
        return this.text(await catalog.searchServices(query, clinicId));
      },
    );

    (this.server.tool as any)(
      'get_visit_services',
      'Типы приёма врача (первичный/повторный) с ценами',
      { clinicNetId: z.number(), doctorId: z.number(), clinicId: z.number().optional() },
      async ({ clinicNetId, doctorId, clinicId }: { clinicNetId: number; doctorId: number; clinicId?: number }) => {
        const { booking } = await this.mis.forNet(clinicNetId);
        return this.text(await booking.visitServices(doctorId, clinicId));
      },
    );

    (this.server.tool as any)(
      'get_available_slots',
      'Свободные слоты врача или услуги',
      {
        clinicNetId: z.number(),
        doctorId: z.number().optional(),
        serviceId: z.union([z.number(), z.string()]).optional(),
        clinicId: z.number().optional(),
        mode: z.enum(['nearest', 'day', 'week']).optional()
          .describe('nearest — ближайший день (по умолчанию), day — конкретный день, week — две недели от date'),
        date: z.string().optional().describe('YYYY-MM-DD, для mode=day/week'),
      },
      async ({ clinicNetId, ...query }: {
        clinicNetId: number;
        doctorId?: number;
        serviceId?: number | string;
        clinicId?: number;
        mode?: 'nearest' | 'day' | 'week';
        date?: string;
      }) => {
        const { booking } = await this.mis.forNet(clinicNetId);
        const slots = await booking.findSlots(query);
        return this.text(slots.map(({ ref: _ref, ...slot }) => slot));
      },
    );

    (this.server.tool as any)(
      'book_appointment',
      'Записать пациента к врачу или на услугу на свободный слот',
      {
        clinicNetId: z.number(),
        doctorId: z.number().optional(),
        serviceId: z.union([z.number(), z.string()]).optional(),
        visitServiceId: z.union([z.number(), z.string()]).optional(),
        clinicId: z.number(),
        startTime: z.string().describe('YYYY-MM-DDTHH:MM — начало слота из get_available_slots'),
        clientId: z.number().optional(),
        lastName: z.string().optional(),
        firstName: z.string().optional(),
        secondName: z.string().optional(),
        phone: z.string().optional(),
        birthday: z.string().optional(),
        comment: z.string().optional(),
      },
      async (a: {
        clinicNetId: number;
        doctorId?: number;
        serviceId?: number | string;
        visitServiceId?: number | string;
        clinicId: number;
        startTime: string;
        clientId?: number;
        lastName?: string;
        firstName?: string;
        secondName?: string;
        phone?: string;
        birthday?: string;
        comment?: string;
      }) => {
        const { booking, catalog } = await this.mis.forNet(a.clinicNetId);
        if (!(await catalog.clinics()).some((c) => c.id === a.clinicId)) {
          return this.text({ status: 'rejected', reason: 'outside_net', message: `Клиника ${a.clinicId} не входит в сеть ${a.clinicNetId}` });
        }
        const slot = await resolveSlot(booking, {
          doctorId: a.doctorId,
          serviceId: a.doctorId ? undefined : a.serviceId,
          clinicId: a.clinicId,
          start: a.startTime,
        });
        if (!slot) return this.text({ status: 'rejected', reason: 'slot_taken', message: 'Слот недоступен' });
        const hasData = a.lastName || a.firstName || a.phone || a.birthday;
        return this.text(await booking.book({
          slot,
          doctorId: a.doctorId,
          serviceId: a.doctorId ? undefined : a.serviceId,
          visitServiceId: a.visitServiceId,
          comment: a.comment,
          patient: {
            clientId: a.clientId,
            data: hasData
              ? { lastName: a.lastName ?? '', firstName: a.firstName ?? '', secondName: a.secondName, phone: a.phone ?? '', birthday: a.birthday ?? '' }
              : undefined,
          },
        }));
      },
    );
  }

  private text(data: unknown) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  async connectInMemory() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await this.server.connect(serverTransport);
    return clientTransport;
  }
}
