/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter, CustomRequestHandlerContext, KibanaRequest } from '@kbn/core/server';
import type {
  ActionTypeConfig,
  ActionTypeSecrets,
  ActionTypeParams,
  ActionType,
} from '@kbn/actions-plugin/server/types';
import type { CasesClient } from './client';
import type { AttachmentFramework } from './attachment_framework/types';
import type { ExternalReferenceAttachmentTypeRegistry } from './attachment_framework/external_reference_registry';
import type { PersistableStateAttachmentTypeRegistry } from './attachment_framework/persistable_state_registry';

export interface CaseRequestContext {
  getCasesClient: () => Promise<CasesClient>;
}

/**
 * @internal
 */
export type CasesRequestHandlerContext = CustomRequestHandlerContext<{
  cases: CaseRequestContext;
}>;

/**
 * @internal
 */
export type CasesRouter = IRouter<CasesRequestHandlerContext>;

export type RegisterActionType = <
  Config extends ActionTypeConfig = ActionTypeConfig,
  Secrets extends ActionTypeSecrets = ActionTypeSecrets,
  Params extends ActionTypeParams = ActionTypeParams,
  ExecutorResultData = void
>(
  actionType: ActionType<Config, Secrets, Params, ExecutorResultData>
) => void;

/**
 * Cases server exposed contract for interacting with cases entities.
 */
export interface CasesStart {
  /**
   * Returns a client which can be used to interact with the cases backend entities.
   *
   * @param request a KibanaRequest
   * @returns a {@link CasesClient}
   */
  getCasesClientWithRequest(request: KibanaRequest): Promise<CasesClient>;
  getExternalReferenceAttachmentTypeRegistry(): ExternalReferenceAttachmentTypeRegistry;
  getPersistableStateAttachmentTypeRegistry(): PersistableStateAttachmentTypeRegistry;
}

export interface CasesSetup {
  attachmentFramework: AttachmentFramework;
}

export type PartialField<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
