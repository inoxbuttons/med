import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenUsage } from '../database/entities/token-usage.entity';

interface MonthlyUsageRow {
  clinicNetId: number | null;
  clinicNetName: string | null;
  month: string;           // "YYYY-MM"
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
}

@Controller('admin/token-usage')
export class TokenUsageController {
  constructor(
    @InjectRepository(TokenUsage)
    private readonly repo: Repository<TokenUsage>,
  ) {}

  /**
   * GET /admin/token-usage
   * Опциональные параметры: year, month, clinicNetId
   * Возвращает агрегацию по месяцам и сетям клиник.
   */
  @Get()
  async getUsage(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('clinicNetId') clinicNetId?: string,
  ): Promise<MonthlyUsageRow[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoin('t.clinicNet', 'cn')
      .select("to_char(date_trunc('month', t.created_at), 'YYYY-MM')", 'month')
      .addSelect('t.clinic_net_id', 'clinicNetId')
      .addSelect('cn.name', 'clinicNetName')
      .addSelect('SUM(t.prompt_tokens)::int', 'promptTokens')
      .addSelect('SUM(t.completion_tokens)::int', 'completionTokens')
      .addSelect('SUM(t.total_tokens)::int', 'totalTokens')
      .addSelect('COUNT(*)::int', 'calls')
      .groupBy('month')
      .addGroupBy('t.clinic_net_id')
      .addGroupBy('cn.name')
      .orderBy('month', 'DESC')
      .addOrderBy('t.clinic_net_id', 'ASC');

    if (year) {
      qb.andWhere("EXTRACT(YEAR FROM t.created_at) = :year", { year: Number(year) });
    }
    if (month) {
      qb.andWhere("EXTRACT(MONTH FROM t.created_at) = :month", { month: Number(month) });
    }
    if (clinicNetId) {
      qb.andWhere('t.clinic_net_id = :clinicNetId', { clinicNetId: Number(clinicNetId) });
    }

    return qb.getRawMany();
  }
}
