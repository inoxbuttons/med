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
const local_db_service_1 = require("../integrations/local/local-db.service");
let McpService = McpService_1 = class McpService {
    constructor(openAi, gigaChat, booking) {
        this.openAi = openAi;
        this.gigaChat = gigaChat;
        this.booking = booking;
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
        this.server.tool('get_clinics', 'Get list of all clinic locations', {}, async () => {
            const result = await this.booking.getClinics();
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        });
        this.server.tool('find_doctors', 'Find doctors by speciality, optionally filtered by clinic', {
            speciality: zod_1.z.string(),
            clinicId: zod_1.z.number().optional(),
        }, async ({ speciality, clinicId }) => {
            const result = await this.booking.findDoctors(speciality, clinicId);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        });
        this.server.tool('find_services', 'Find medical services by name', {
            query: zod_1.z.string(),
            clinicId: zod_1.z.number().optional(),
        }, async ({ query, clinicId }) => {
            const result = await this.booking.findServices(query, clinicId);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        });
        this.server.tool('get_available_slots', 'Get available appointment slots for a doctor or service', {
            doctorId: zod_1.z.number().optional(),
            serviceId: zod_1.z.number().optional(),
            clinicId: zod_1.z.number().optional(),
            fromDate: zod_1.z.string().optional(),
            days: zod_1.z.number().optional(),
        }, async (args) => {
            const result = await this.booking.getAvailableSlots(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        });
        this.server.tool('book_appointment', 'Book an appointment for a patient', {
            doctorId: zod_1.z.number().optional(),
            serviceId: zod_1.z.number().optional(),
            clinicId: zod_1.z.number(),
            startTime: zod_1.z.string(),
            patientName: zod_1.z.string().optional(),
        }, async (args) => {
            const result = await this.booking.bookAppointment(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        });
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
        local_db_service_1.LocalDbService])
], McpService);
//# sourceMappingURL=mcp.service.js.map