/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DataView } from '@kbn/data-views-plugin/common';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { BASE_RAC_ALERTS_API_PATH } from '@kbn/rule-registry-plugin/common';
import type { ValidFeatureId } from '@kbn/rule-data-utils';
import type { HttpStart } from '@kbn/core/public';
import useAsync from 'react-use/lib/useAsync';
import type { AsyncState } from 'react-use/lib/useAsync';
import { DataPublicPluginStart } from '@kbn/data-plugin/public';
import { TriggersAndActionsUiServices } from '../..';

export const loadAlertDataView = async ({
  http,
  dataService,
  featureIds,
}: {
  http: HttpStart;
  dataService: DataPublicPluginStart;
  featureIds: ValidFeatureId[];
}): Promise<DataView> => {
  const features = featureIds.sort().join(',');
  const { index_name: indexNames } = await http.get<{ index_name: string[] }>(
    `${BASE_RAC_ALERTS_API_PATH}/index`,
    {
      query: { features },
    }
  );
  return dataService.dataViews.create({ title: indexNames.join(','), allowNoIndex: true });
};

export function useAlertDataView(featureIds: ValidFeatureId[]): AsyncState<DataView> {
  const { http, data: dataService } = useKibana<TriggersAndActionsUiServices>().services;

  const dataView = useAsync(async () => {
    return loadAlertDataView({ http, dataService, featureIds });
  }, [featureIds]);

  return dataView;
}
