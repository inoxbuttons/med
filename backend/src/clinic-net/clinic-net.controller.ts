import { Controller } from '@nestjs/common';
import { ClinicNetService } from './clinic-net.service';

@Controller('clinic-net')
export class ClinicNetController {
  constructor(private readonly clinicNetService: ClinicNetService) {}
}
