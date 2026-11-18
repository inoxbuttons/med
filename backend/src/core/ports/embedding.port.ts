/** Векторизация текста для семантического поиска. */
export interface EmbeddingPort {
  /** false — эмбеддинги выключены: поиск работает только по тексту и триграммам. */
  readonly enabled: boolean;
  readonly model: string;
  readonly dimensions: number;
  /** Порядок результатов совпадает с порядком texts. */
  embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]>;
}
