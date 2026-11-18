import { z } from 'zod';
declare const symptomHint: z.ZodObject<{
    match: z.ZodArray<z.ZodString, "many">;
    speciality: z.ZodString;
    fallback: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    match?: string[];
    speciality?: string;
    fallback?: string;
}, {
    match?: string[];
    speciality?: string;
    fallback?: string;
}>;
export declare const clinicProfileSchema: z.ZodObject<{
    slug: z.ZodString;
    clinicNetId: z.ZodNullable<z.ZodNumber>;
    displayName: z.ZodDefault<z.ZodString>;
    engine: z.ZodEnum<["tools", "pipeline"]>;
    llm: z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<["openai", "gigachat", "qwen", "qwen3"]>>;
        model: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        model?: string;
        provider?: "openai" | "gigachat" | "qwen" | "qwen3";
    }, {
        model?: string;
        provider?: "openai" | "gigachat" | "qwen" | "qwen3";
    }>;
    features: z.ZodObject<{
        visitTypeQuestion: z.ZodBoolean;
        referralFlow: z.ZodEnum<["operator", "doctor", "off"]>;
        showPrices: z.ZodEnum<["always", "on_request", "never"]>;
        walkIn: z.ZodEnum<["yes", "no", "unknown"]>;
        questions: z.ZodArray<z.ZodEnum<["schedule", "price", "address", "hours", "walk_in", "has_service", "preparation"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        visitTypeQuestion?: boolean;
        referralFlow?: "doctor" | "operator" | "off";
        showPrices?: "never" | "always" | "on_request";
        walkIn?: "unknown" | "yes" | "no";
        questions?: ("price" | "address" | "schedule" | "hours" | "walk_in" | "has_service" | "preparation")[];
    }, {
        visitTypeQuestion?: boolean;
        referralFlow?: "doctor" | "operator" | "off";
        showPrices?: "never" | "always" | "on_request";
        walkIn?: "unknown" | "yes" | "no";
        questions?: ("price" | "address" | "schedule" | "hours" | "walk_in" | "has_service" | "preparation")[];
    }>;
    patientFields: z.ZodArray<z.ZodEnum<["fullName", "phone", "birthday"]>, "many">;
    synonyms: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    symptomHints: z.ZodArray<z.ZodObject<{
        match: z.ZodArray<z.ZodString, "many">;
        speciality: z.ZodString;
        fallback: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        match?: string[];
        speciality?: string;
        fallback?: string;
    }, {
        match?: string[];
        speciality?: string;
        fallback?: string;
    }>, "many">;
    serviceAreas: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        match: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        match?: string[];
        label?: string;
    }, {
        match?: string[];
        label?: string;
    }>, "many">>;
    templates: z.ZodRecord<z.ZodString, z.ZodString>;
    info: z.ZodObject<{
        about: z.ZodDefault<z.ZodString>;
        hours: z.ZodDefault<z.ZodString>;
        phone: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        phone?: string;
        hours?: string;
        about?: string;
    }, {
        phone?: string;
        hours?: string;
        about?: string;
    }>;
}, "strip", z.ZodTypeAny, {
    clinicNetId?: number;
    slug?: string;
    displayName?: string;
    engine?: "tools" | "pipeline";
    llm?: {
        model?: string;
        provider?: "openai" | "gigachat" | "qwen" | "qwen3";
    };
    features?: {
        visitTypeQuestion?: boolean;
        referralFlow?: "doctor" | "operator" | "off";
        showPrices?: "never" | "always" | "on_request";
        walkIn?: "unknown" | "yes" | "no";
        questions?: ("price" | "address" | "schedule" | "hours" | "walk_in" | "has_service" | "preparation")[];
    };
    patientFields?: ("phone" | "fullName" | "birthday")[];
    synonyms?: Record<string, string[]>;
    symptomHints?: {
        match?: string[];
        speciality?: string;
        fallback?: string;
    }[];
    serviceAreas?: {
        match?: string[];
        label?: string;
    }[];
    templates?: Record<string, string>;
    info?: {
        phone?: string;
        hours?: string;
        about?: string;
    };
}, {
    clinicNetId?: number;
    slug?: string;
    displayName?: string;
    engine?: "tools" | "pipeline";
    llm?: {
        model?: string;
        provider?: "openai" | "gigachat" | "qwen" | "qwen3";
    };
    features?: {
        visitTypeQuestion?: boolean;
        referralFlow?: "doctor" | "operator" | "off";
        showPrices?: "never" | "always" | "on_request";
        walkIn?: "unknown" | "yes" | "no";
        questions?: ("price" | "address" | "schedule" | "hours" | "walk_in" | "has_service" | "preparation")[];
    };
    patientFields?: ("phone" | "fullName" | "birthday")[];
    synonyms?: Record<string, string[]>;
    symptomHints?: {
        match?: string[];
        speciality?: string;
        fallback?: string;
    }[];
    serviceAreas?: {
        match?: string[];
        label?: string;
    }[];
    templates?: Record<string, string>;
    info?: {
        phone?: string;
        hours?: string;
        about?: string;
    };
}>;
export type ClinicProfile = z.infer<typeof clinicProfileSchema>;
export type SymptomHint = z.infer<typeof symptomHint>;
export declare function mergeProfile<T>(base: T, override: unknown): T;
export {};
