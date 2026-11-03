import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { BusinessContext } from "@asn/types";

export const CurrentBusiness = createParamDecorator(
  (data: keyof BusinessContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const business: BusinessContext = request.businessContext;
    return data ? business?.[data] : business;
  },
);
