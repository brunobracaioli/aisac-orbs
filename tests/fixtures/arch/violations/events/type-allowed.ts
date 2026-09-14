import type { FormationDomainType } from "../formations/domain/types";
import type { RendererPort } from "../engine/ports/RendererPort";

export type AllowedEventContracts = FormationDomainType & RendererPort;
