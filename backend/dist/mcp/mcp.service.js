"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var McpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpService = void 0;
const common_1 = require("@nestjs/common");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const inMemory_js_1 = require("@modelcontextprotocol/sdk/inMemory.js");
const zod_1 = require("zod");
const openai_service_1 = require("../llm/openai.service");
const gigachat_service_1 = require("../llm/gigachat.service");
const mis_registry_service_1 = require("../adapters/mis/mis-registry.service");
const ports_1 = require("../core/ports");
let McpService = McpService_1 = class McpService {
    constructor(openAi, gigaChat, mis) {
        this.openAi = openAi;
        this.gigaChat = gigaChat;
        this.mis = mis;
        this.logger = new common_1.Logger(McpService_1.name);
        this.server = new mcp_js_1.McpServer({ name: 'med-mcp-server', version: '0.1.0' });
    }
    onModuleInit() {
        this.registerTools();
        this.logger.log('MCP server initialized with tools registered');
    }
    registerTools() {
        this.server.tool('ask_openai', 'Send a prompt to OpenAI and get a response', { prompt: zod_1.z.string(), model: zod_1.z.string().optional() }, async ({ prompt, model }) => {
            const content = await this.openAi.chat([{ role: 'user', content: prompt }], model);
            return { content: [{ type: 'text', text: content }] };
        });
        this.server.tool('ask_gigachat', 'Send a prompt to GigaChat and get a response', { prompt: zod_1.z.string(), model: zod_1.z.string().optional() }, async ({ prompt, model }) => {
            const content = await this.gigaChat.chat([{ role: 'user', content: prompt }], model);
            return { content: [{ type: 'text', text: content }] };
        });
        this.server.tool('get_clinics', 'Клиники сети', { clinicNetId: zod_1.z.number() }, async ({ clinicNetId }) => {
            const { catalog } = await this.mis.forNet(clinicNetId);
            return this.text(await catalog.clinics());
        });
        this.server.tool('find_doctors', 'Поиск врачей сети по специальности или фамилии', { clinicNetId: zod_1.z.number(), query: zod_1.z.string(), clinicId: zod_1.z.number().optional() }, async ({ clinicNetId, query, clinicId }) => {
            const { catalog } = await this.mis.forNet(clinicNetId);
            return this.text(await catalog.searchDoctors(query, clinicId));
        });
        this.server.tool('find_services', 'Поиск услуг сети по названию', { clinicNetId: zod_1.z.number(), query: zod_1.z.string(), clinicId: zod_1.z.number().optional() }, async ({ clinicNetId, query, clinicId }) => {
            const { catalog } = await this.mis.forNet(clinicNetId);
            return this.text(await catalog.searchServices(query, clinicId));
        });
        this.server.tool('get_visit_services', 'Типы приёма врача (первичный/повторный) с ценами', { clinicNetId: zod_1.z.number(), doctorId: zod_1.z.number(), clinicId: zod_1.z.number().optional() }, async ({ clinicNetId, doctorId, clinicId }) => {
            const { booking } = await this.mis.forNet(clinicNetId);
            return this.text(await booking.visitServices(doctorId, clinicId));
        });
        this.server.tool('get_available_slots', 'Свободные слоты врача или услуги', {
            clinicNetId: zod_1.z.number(),
            doctorId: zod_1.z.number().optional(),
            serviceId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
            clinicId: zod_1.z.number().optional(),
            mode: zod_1.z.enum(['nearest', 'day', 'week']).optional()
                .describe('nearest — ближайший день (по умолчанию), day — конкретный день, week — две недели от date'),
            date: zod_1.z.string().optional().describe('YYYY-MM-DD, для mode=day/week'),
        }, async ({ clinicNetId, ...query }) => {
            const { booking } = await this.mis.forNet(clinicNetId);
            const slots = await booking.findSlots(query);
            return this.text(slots.map(({ ref: _ref, ...slot }) => slot));
        });
        this.server.tool('book_appointment', 'Записать пациента к врачу или на услугу на свободный слот', {
            clinicNetId: zod_1.z.number(),
            doctorId: zod_1.z.number().optional(),
            serviceId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
            visitServiceId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
            clinicId: zod_1.z.number(),
            startTime: zod_1.z.string().describe('YYYY-MM-DDTHH:MM — начало слота из get_available_slots'),
            clientId: zod_1.z.number().optional(),
            lastName: zod_1.z.string().optional(),
            firstName: zod_1.z.string().optional(),
            secondName: zod_1.z.string().optional(),
            phone: zod_1.z.string().optional(),
            birthday: zod_1.z.string().optional(),
            comment: zod_1.z.string().optional(),
        }, async (a) => {
            const { booking, catalog } = await this.mis.forNet(a.clinicNetId);
            if (!(await catalog.clinics()).some((c) => c.id === a.clinicId)) {
                return this.text({ status: 'rejected', reason: 'outside_net', message: `Клиника ${a.clinicId} не входит в сеть ${a.clinicNetId}` });
            }
            const slot = await (0, ports_1.resolveSlot)(booking, {
                doctorId: a.doctorId,
                serviceId: a.doctorId ? undefined : a.serviceId,
                clinicId: a.clinicId,
                start: a.startTime,
            });
            if (!slot)
                return this.text({ status: 'rejected', reason: 'slot_taken', message: 'Слот недоступен' });
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
        });
    }
    text(data) {
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    async connectInMemory() {
        const [clientTransport, serverTransport] = inMemory_js_1.InMemoryTransport.createLinkedPair();
        await this.server.connect(serverTransport);
        return clientTransport;
    }
};
exports.McpService = McpService;
exports.McpService = McpService = McpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        gigachat_service_1.GigaChatService,
        mis_registry_service_1.MisRegistry])
], McpService);
//# sourceMappingURL=mcp.service.js.map