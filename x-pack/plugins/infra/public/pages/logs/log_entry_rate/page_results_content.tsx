/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiSuperDatePicker } from '@elastic/eui';
import type { Query } from '@kbn/es-query';
import moment from 'moment';
import { stringify } from 'query-string';
import React, { useCallback, useMemo } from 'react';
import { encode } from '@kbn/rison';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { MLJobsAwaitingNodeWarning } from '@kbn/ml-plugin/public';
import { useTrackPageview } from '@kbn/observability-plugin/public';
import { isJobStatusWithResults } from '../../../../common/log_analysis';
import { TimeKey } from '../../../../common/time';
import {
  CategoryJobNoticesSection,
  LogAnalysisJobProblemIndicator,
} from '../../../components/logging/log_analysis_job_status';
import { DatasetsSelector } from '../../../components/logging/log_analysis_results/datasets_selector';
import { ManageJobsButton } from '../../../components/logging/log_analysis_setup/manage_jobs_button';
import { useLogAnalysisSetupFlyoutStateContext } from '../../../components/logging/log_analysis_setup/setup_flyout';
import { LogEntryFlyout } from '../../../components/logging/log_entry_flyout';
import { useLogAnalysisCapabilitiesContext } from '../../../containers/logs/log_analysis/log_analysis_capabilities';
import { useLogEntryCategoriesModuleContext } from '../../../containers/logs/log_analysis/modules/log_entry_categories';
import { useLogEntryRateModuleContext } from '../../../containers/logs/log_analysis/modules/log_entry_rate';
import { useLogEntryFlyoutContext } from '../../../containers/logs/log_flyout';
import { useLogViewContext } from '../../../hooks/use_log_view';
import { LogsPageTemplate } from '../shared/page_template';
import { AnomaliesResults } from './sections/anomalies';
import { useDatasetFiltering } from './use_dataset_filtering';
import { useLogEntryAnomaliesResults } from './use_log_entry_anomalies_results';
import { useLogAnalysisResultsUrlState } from './use_log_entry_rate_results_url_state';

export const SORT_DEFAULTS = {
  direction: 'desc' as const,
  field: 'anomalyScore' as const,
};

export const PAGINATION_DEFAULTS = {
  pageSize: 25,
};

export const LogEntryRateResultsContent: React.FunctionComponent<{
  pageTitle: string;
}> = ({ pageTitle }) => {
  useTrackPageview({ app: 'infra_logs', path: 'log_entry_rate_results' });
  useTrackPageview({ app: 'infra_logs', path: 'log_entry_rate_results', delay: 15000 });

  const navigateToApp = useKibana().services.application?.navigateToApp;

  const { logViewReference, logViewStatus } = useLogViewContext();

  if (logViewReference.type === 'log-view-inline') {
    throw new Error('Logs ML features only support persisted Log Views');
  }

  const { hasLogAnalysisSetupCapabilities } = useLogAnalysisCapabilitiesContext();

  const {
    hasOutdatedJobConfigurations: hasOutdatedLogEntryRateJobConfigurations,
    hasOutdatedJobDefinitions: hasOutdatedLogEntryRateJobDefinitions,
    hasStoppedJobs: hasStoppedLogEntryRateJobs,
    moduleDescriptor: logEntryRateModuleDescriptor,
    setupStatus: logEntryRateSetupStatus,
    jobStatus: logEntryRateJobStatus,
    jobIds: logEntryRateJobIds,
  } = useLogEntryRateModuleContext();

  const {
    categoryQualityWarnings,
    hasOutdatedJobConfigurations: hasOutdatedLogEntryCategoriesJobConfigurations,
    hasOutdatedJobDefinitions: hasOutdatedLogEntryCategoriesJobDefinitions,
    hasStoppedJobs: hasStoppedLogEntryCategoriesJobs,
    moduleDescriptor: logEntryCategoriesModuleDescriptor,
    setupStatus: logEntryCategoriesSetupStatus,
    jobStatus: logEntryCategoriesJobStatus,
    jobIds: logEntryCategoriesJobIds,
  } = useLogEntryCategoriesModuleContext();

  const jobIds = useMemo(() => {
    return [
      ...(isJobStatusWithResults(logEntryRateJobStatus['log-entry-rate'])
        ? [logEntryRateJobIds['log-entry-rate']]
        : []),
      ...(isJobStatusWithResults(logEntryCategoriesJobStatus['log-entry-categories-count'])
        ? [logEntryCategoriesJobIds['log-entry-categories-count']]
        : []),
    ];
  }, [
    logEntryRateJobIds,
    logEntryCategoriesJobIds,
    logEntryRateJobStatus,
    logEntryCategoriesJobStatus,
  ]);

  const {
    timeRange,
    friendlyTimeRange,
    setTimeRange: setSelectedTimeRange,
    autoRefresh,
    setAutoRefresh,
  } = useLogAnalysisResultsUrlState();

  const {
    closeFlyout: closeLogEntryFlyout,
    isFlyoutOpen: isLogEntryFlyoutOpen,
    logEntryId: flyoutLogEntryId,
  } = useLogEntryFlyoutContext();

  const linkToLogStream = useCallback(
    (filterQuery: Query, id: string, timeKey?: TimeKey) => {
      const params = {
        logPosition: encode({
          end: moment(timeRange.value.endTime).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
          position: timeKey,
          start: moment(timeRange.value.startTime).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
          streamLive: false,
        }),
        flyoutOptions: encode({
          surroundingLogsId: id,
        }),
        logFilter: encode(filterQuery),
      };

      navigateToApp?.('logs', { path: `/stream?${stringify(params)}` });
    },
    [timeRange, navigateToApp]
  );

  const { selectedDatasets, setSelectedDatasets } = useDatasetFiltering();

  const {
    isLoadingLogEntryAnomalies,
    logEntryAnomalies,
    page,
    fetchNextPage,
    fetchPreviousPage,
    changeSortOptions,
    changePaginationOptions,
    sortOptions,
    paginationOptions,
    datasets,
    isLoadingDatasets,
  } = useLogEntryAnomaliesResults({
    logViewReference,
    startTime: timeRange.value.startTime,
    endTime: timeRange.value.endTime,
    defaultSortOptions: SORT_DEFAULTS,
    defaultPaginationOptions: PAGINATION_DEFAULTS,
    filteredDatasets: selectedDatasets,
  });

  const handleAutoRefreshChange = useCallback(
    ({ isPaused, refreshInterval: interval }: { isPaused: boolean; refreshInterval: number }) => {
      setAutoRefresh({
        isPaused,
        interval,
      });
    },
    [setAutoRefresh]
  );

  const { showModuleList, showModuleSetup } = useLogAnalysisSetupFlyoutStateContext();

  const showLogEntryRateSetup = useCallback(
    () => showModuleSetup('logs_ui_analysis'),
    [showModuleSetup]
  );
  const showLogEntryCategoriesSetup = useCallback(
    () => showModuleSetup('logs_ui_categories'),
    [showModuleSetup]
  );

  const hasAnomalyResults = logEntryAnomalies.length > 0;

  const isFirstUse = useMemo(
    () =>
      ((logEntryCategoriesSetupStatus.type === 'skipped' &&
        !!logEntryCategoriesSetupStatus.newlyCreated) ||
        logEntryCategoriesSetupStatus.type === 'succeeded' ||
        (logEntryRateSetupStatus.type === 'skipped' && !!logEntryRateSetupStatus.newlyCreated) ||
        logEntryRateSetupStatus.type === 'succeeded') &&
      !hasAnomalyResults,
    [hasAnomalyResults, logEntryCategoriesSetupStatus, logEntryRateSetupStatus]
  );

  const handleSelectedTimeRangeChange = useCallback(
    (selectedTime: { start: string; end: string; isInvalid: boolean }) => {
      if (selectedTime.isInvalid) {
        return;
      }
      setSelectedTimeRange(selectedTime);
    },
    [setSelectedTimeRange]
  );

  return (
    <LogsPageTemplate
      hasData={logViewStatus?.index !== 'missing'}
      pageHeader={{
        pageTitle,
        rightSideItems: [<ManageJobsButton onClick={showModuleList} size="s" />],
      }}
    >
      <EuiFlexGroup direction="column">
        <EuiFlexItem grow={false}>
          <EuiFlexGroup justifyContent="spaceBetween">
            <EuiFlexItem>
              <DatasetsSelector
                availableDatasets={datasets}
                isLoading={isLoadingDatasets}
                selectedDatasets={selectedDatasets}
                onChangeDatasetSelection={setSelectedDatasets}
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiSuperDatePicker
                start={friendlyTimeRange.startTime}
                end={friendlyTimeRange.endTime}
                onTimeChange={handleSelectedTimeRangeChange}
                isPaused={autoRefresh.isPaused}
                refreshInterval={autoRefresh.interval}
                onRefreshChange={handleAutoRefreshChange}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <LogAnalysisJobProblemIndicator
            hasOutdatedJobConfigurations={hasOutdatedLogEntryRateJobConfigurations}
            hasOutdatedJobDefinitions={hasOutdatedLogEntryRateJobDefinitions}
            hasSetupCapabilities={hasLogAnalysisSetupCapabilities}
            hasStoppedJobs={hasStoppedLogEntryRateJobs}
            isFirstUse={false /* the first use message is already shown by the section below */}
            moduleName={logEntryRateModuleDescriptor.moduleName}
            onRecreateMlJobForReconfiguration={showLogEntryRateSetup}
            onRecreateMlJobForUpdate={showLogEntryRateSetup}
          />
          <MLJobsAwaitingNodeWarning jobIds={jobIds} />
          <CategoryJobNoticesSection
            hasOutdatedJobConfigurations={hasOutdatedLogEntryCategoriesJobConfigurations}
            hasOutdatedJobDefinitions={hasOutdatedLogEntryCategoriesJobDefinitions}
            hasSetupCapabilities={hasLogAnalysisSetupCapabilities}
            hasStoppedJobs={hasStoppedLogEntryCategoriesJobs}
            isFirstUse={isFirstUse}
            moduleName={logEntryCategoriesModuleDescriptor.moduleName}
            onRecreateMlJobForReconfiguration={showLogEntryCategoriesSetup}
            onRecreateMlJobForUpdate={showLogEntryCategoriesSetup}
            qualityWarnings={categoryQualityWarnings}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <AnomaliesResults
            isLoadingAnomaliesResults={isLoadingLogEntryAnomalies}
            anomalies={logEntryAnomalies}
            timeRange={timeRange.value}
            page={page}
            fetchNextPage={fetchNextPage}
            fetchPreviousPage={fetchPreviousPage}
            changeSortOptions={changeSortOptions}
            changePaginationOptions={changePaginationOptions}
            sortOptions={sortOptions}
            paginationOptions={paginationOptions}
            selectedDatasets={selectedDatasets}
            jobIds={jobIds}
            autoRefresh={autoRefresh}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      {isLogEntryFlyoutOpen ? (
        <LogEntryFlyout
          logEntryId={flyoutLogEntryId}
          onCloseFlyout={closeLogEntryFlyout}
          onSetFieldFilter={linkToLogStream}
          logViewReference={logViewReference}
        />
      ) : null}
    </LogsPageTemplate>
  );
};
