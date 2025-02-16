/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import {
  ALL_VALUE,
  apmTransactionErrorRateIndicatorSchema,
  timeslicesBudgetingMethodSchema,
} from '@kbn/slo-schema';

import { InvalidTransformError } from '../../../errors';
import { getSLOTransformTemplate } from '../../../assets/transform_templates/slo_transform_template';
import { getElastichsearchQueryOrThrow, TransformGenerator } from '.';
import {
  SLO_DESTINATION_INDEX_NAME,
  SLO_INGEST_PIPELINE_NAME,
  getSLOTransformId,
} from '../../../assets/constants';
import { APMTransactionErrorRateIndicator, SLO } from '../../../domain/models';
import { Query } from './types';
import { parseIndex } from './common';

const ALLOWED_STATUS_CODES = ['2xx', '3xx', '4xx', '5xx'];
const DEFAULT_GOOD_STATUS_CODES = ['2xx', '3xx', '4xx'];

export class ApmTransactionErrorRateTransformGenerator extends TransformGenerator {
  public getTransformParams(slo: SLO): TransformPutTransformRequest {
    if (!apmTransactionErrorRateIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      this.buildSource(slo, slo.indicator),
      this.buildDestination(),
      this.buildGroupBy(slo),
      this.buildAggregations(slo, slo.indicator),
      this.buildSettings(slo)
    );
  }

  private buildTransformId(slo: SLO): string {
    return getSLOTransformId(slo.id, slo.revision);
  }

  private buildSource(slo: SLO, indicator: APMTransactionErrorRateIndicator) {
    const queryFilter: Query[] = [
      {
        range: {
          '@timestamp': {
            gte: `now-${slo.timeWindow.duration.format()}`,
          },
        },
      },
    ];

    if (indicator.params.service !== ALL_VALUE) {
      queryFilter.push({
        match: {
          'service.name': indicator.params.service,
        },
      });
    }

    if (indicator.params.environment !== ALL_VALUE) {
      queryFilter.push({
        match: {
          'service.environment': indicator.params.environment,
        },
      });
    }

    if (indicator.params.transactionName !== ALL_VALUE) {
      queryFilter.push({
        match: {
          'transaction.name': indicator.params.transactionName,
        },
      });
    }

    if (indicator.params.transactionType !== ALL_VALUE) {
      queryFilter.push({
        match: {
          'transaction.type': indicator.params.transactionType,
        },
      });
    }

    if (indicator.params.filter) {
      queryFilter.push(getElastichsearchQueryOrThrow(indicator.params.filter));
    }

    return {
      index: parseIndex(indicator.params.index),
      runtime_mappings: this.buildCommonRuntimeMappings(slo),
      query: {
        bool: {
          filter: [
            { terms: { 'processor.event': ['metric'] } },
            { term: { 'metricset.name': 'transaction' } },
            { exists: { field: 'transaction.duration.histogram' } },
            { exists: { field: 'transaction.result' } },
            ...queryFilter,
          ],
        },
      },
    };
  }

  private buildDestination() {
    return {
      pipeline: SLO_INGEST_PIPELINE_NAME,
      index: SLO_DESTINATION_INDEX_NAME,
    };
  }

  private buildAggregations(slo: SLO, indicator: APMTransactionErrorRateIndicator) {
    const goodStatusCodesFilter = this.getGoodStatusCodesFilter(indicator.params.goodStatusCodes);

    return {
      'slo.numerator': {
        filter: {
          bool: {
            should: goodStatusCodesFilter,
          },
        },
      },
      'slo.denominator': {
        value_count: {
          field: 'transaction.duration.histogram',
        },
      },
      ...(timeslicesBudgetingMethodSchema.is(slo.budgetingMethod) && {
        'slo.isGoodSlice': {
          bucket_script: {
            buckets_path: {
              goodEvents: 'slo.numerator>_count',
              totalEvents: 'slo.denominator.value',
            },
            script: `params.goodEvents / params.totalEvents >= ${slo.objective.timesliceTarget} ? 1 : 0`,
          },
        },
      }),
    };
  }

  private getGoodStatusCodesFilter(goodStatusCodes: string[] | undefined) {
    let statusCodes = goodStatusCodes?.filter((code) => ALLOWED_STATUS_CODES.includes(code));
    if (statusCodes === undefined || statusCodes.length === 0) {
      statusCodes = DEFAULT_GOOD_STATUS_CODES;
    }

    return statusCodes.map((code) => ({
      match: {
        'transaction.result': `HTTP ${code}`,
      },
    }));
  }
}
