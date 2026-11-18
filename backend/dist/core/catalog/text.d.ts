export declare function normalize(text: string): string;
export declare function words(text: string): string[];
export declare function expandForIndex(text: string, synonyms: Record<string, string[]>): string;
export declare function toTsGroups(query: string, synonyms: Record<string, string[]>): string[];
export declare function sameStem(a: string, b: string): boolean;
export declare function toTsQuery(query: string, synonyms: Record<string, string[]>): string;
