import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  readonly server: McpServer;

  constructor(
    private readonly openAi: OpenAiService,
    private readonly gigaChat: GigaChatService,
    private readonly booking: BookingService,
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
      'Get list of all clinic locations',
      {},
      async () => {
        const result = await this.booking.getClinics();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    (this.server.tool as any)(
      'find_doctors',
      'Find doctors by speciality, optionally filtered by clinic',
      {
        speciality: z.string(),
        clinicId: z.number().optional(),
      },
      async ({ speciality, clinicId }: { speciality: string; clinicId?: number }) => {
        const result = await this.booking.findDoctors(speciality, clinicId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    (this.server.tool as any)(
      'find_services',
      'Find medical services by name',
      {
        query: z.string(),
        clinicId: z.number().optional(),
      },
      async ({ query, clinicId }: { query: string; clinicId?: number }) => {
        const result = await this.booking.findServices(query, clinicId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    (this.server.tool as any)(
      'get_available_slots',
      'Get available appointment slots for a doctor or service',
      {
        doctorId: z.number().optional(),
        serviceId: z.number().optional(),
        clinicId: z.number().optional(),
        fromDate: z.string().optional(),
        days: z.number().optional(),
      },
      async (args: {
        doctorId?: number;
        serviceId?: number;
        clinicId?: number;
        fromDate?: string;
        days?: number;
      }) => {
        const result = await this.booking.getAvailableSlots(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    (this.server.tool as any)(
      'book_appointment',
      'Book an appointment for a patient',
      {
        doctorId: z.number().optional(),
        serviceId: z.number().optional(),
        clinicId: z.number(),
        startTime: z.string(),
        patientName: z.string().optional(),
      },
      async (args: {
        doctorId?: number;
        serviceId?: number;
        clinicId: number;
        startTime: string;
        patientName?: string;
      }) => {
        const result = await this.booking.bookAppointment(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );
  }

  async connectInMemory() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await this.server.connect(serverTransport);
    return clientTransport;
  }
}
