import { ActionResult, OperatorRequestInput } from '../../../core/domain';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
export declare function createOperatorRequest(local: LocalDbService, input: OperatorRequestInput): Promise<ActionResult & {
    id: number;
}>;
